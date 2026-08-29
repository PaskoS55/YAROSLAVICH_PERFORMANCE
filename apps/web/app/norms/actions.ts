'use server';

import type { NormInterpretationType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { prisma } from '../../lib/prisma';
import { requireAppContext } from '../../lib/app-context';
import { validateReferenceFields } from '../../lib/reference-policy';
import { PROFILE_CONFIRMATION_ACTION, profileConfirmation } from '../../lib/player-profile';
import { requireReferenceActor } from '../../lib/reference-actor';

export type ReferenceActionState = { ok?: boolean; error?: string; profileId?: string } | null;
const numberOrNull = (value: FormDataEntryValue | null) => {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export async function assignReferenceProfile(_state: ReferenceActionState, formData: FormData): Promise<ReferenceActionState> {
  const actorId = await requireReferenceActor();
  const context = await requireAppContext();
  const profileId = String(formData.get('profileId') ?? '');
  const profile = await prisma.normProfile.findFirst({ where: { id: profileId, deletedAt: null, status: 'ACTIVE', OR: [{ scope: 'SYSTEM' }, { scope: 'ORGANIZATION', organizationId: context.organizationId }] } });
  if (!profile) return { error: 'Профиль недоступен для текущей организации.' };
  if (formData.get('compatibilityConfirmed') !== 'yes') return { error: 'Подтвердите соответствие команды полу, возрастной группе, уровню и протоколам выбранного референса.' };
  await prisma.$transaction(async tx => {
    await tx.team.update({ where: { id: context.teamId }, data: { activeNormProfileId: profile.id } });
    await tx.auditLog.create({ data: { action: PROFILE_CONFIRMATION_ACTION, entity: 'Team', entityId: context.teamId, userId: actorId, newValues: profileConfirmation(profile) } });
  });
  revalidatePath('/players', 'layout');
  revalidatePath('/norms'); revalidatePath('/settings'); revalidatePath('/analytics'); revalidatePath('/compare');
  return { ok: true, profileId: profile.id };
}

export async function cloneReferenceProfile(_state: ReferenceActionState, formData: FormData): Promise<ReferenceActionState> {
  await requireReferenceActor();
  const context = await requireAppContext();
  const sourceId = String(formData.get('profileId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (name.length < 3 || name.length > 120) return { error: 'Введите название профиля от 3 до 120 символов.' };
  const source = await prisma.normProfile.findFirst({ where: { id: sourceId, deletedAt: null, OR: [{ scope: 'SYSTEM' }, { scope: 'INSTALLATION_LEGACY' }, { scope: 'ORGANIZATION', organizationId: context.organizationId }] }, include: { entries: { where: { deletedAt: null }, include: { sources: true } } } });
  if (!source) return { error: 'Исходный профиль недоступен.' };
  const code = `ORG_${context.organizationId}_${randomUUID()}`;
  const clone = await prisma.$transaction(async (tx) => {
    const profile = await tx.normProfile.create({ data: { code, name, sport: source.sport, sex: source.sex, level: source.level, ageGroup: source.ageGroup, version: '1.0', scope: 'ORGANIZATION', status: 'ACTIVE', organizationId: context.organizationId, baseProfileId: source.id } });
    for (const entry of source.entries) {
      const { id: _id, profileId: _profileId, createdAt: _createdAt, updatedAt: _updatedAt, sources, ...data } = entry;
      const copied = await tx.normEntry.create({ data: { ...data, profileId: profile.id } });
      if (sources.length) await tx.normEntrySource.createMany({ data: sources.map((link) => ({ entryId: copied.id, sourceId: link.sourceId, role: link.role })) });
    }
    return profile;
  });
  revalidatePath('/norms'); revalidatePath('/settings');
  return { ok: true, profileId: clone.id };
}

export async function updateReferenceEntry(_state: ReferenceActionState, formData: FormData): Promise<ReferenceActionState> {
  await requireReferenceActor();
  const context = await requireAppContext();
  const entryId = String(formData.get('entryId') ?? '');
  const entry = await prisma.normEntry.findFirst({ where: { id: entryId, deletedAt: null, profile: { scope: 'ORGANIZATION', organizationId: context.organizationId, deletedAt: null } } });
  if (!entry) return { error: 'Системные и чужие референсы нельзя изменять.' };
  const interpretationType = String(formData.get('interpretationType') ?? entry.interpretationType) as NormInterpretationType;
  const values = { mean: numberOrNull(formData.get('mean')), sd: numberOrNull(formData.get('sd')), ciLow: numberOrNull(formData.get('ciLow')), ciHigh: numberOrNull(formData.get('ciHigh')), referenceLow: numberOrNull(formData.get('referenceLow')), referenceHigh: numberOrNull(formData.get('referenceHigh')), p10: numberOrNull(formData.get('p10')), p25: numberOrNull(formData.get('p25')), p50: numberOrNull(formData.get('p50')), p75: numberOrNull(formData.get('p75')), p90: numberOrNull(formData.get('p90')) };
  if (Object.values(values).some((value) => Number.isNaN(value))) return { error: 'Числовые поля заполнены некорректно.' };
  const error = validateReferenceFields({ interpretationType, ...values });
  if (error) return { error };
  await prisma.normEntry.update({ where: { id: entry.id }, data: { interpretationType, ...values, notes: String(formData.get('notes') ?? '').trim() || null, sourceText: String(formData.get('sourceText') ?? '').trim() || null } });
  revalidatePath('/norms'); revalidatePath('/analytics'); revalidatePath('/compare');
  return { ok: true, profileId: entry.profileId };
}

export async function rejectSystemProfileMutation(profileId: string) {
  const context = await requireAppContext();
  const profile = await prisma.normProfile.findFirst({ where: { id: profileId, OR: [{ scope: 'SYSTEM' }, { scope: 'ORGANIZATION', organizationId: context.organizationId }] } });
  if (!profile || profile.scope === 'SYSTEM') return { error: 'Системный профиль доступен только для чтения.' };
  return { ok: true };
}
