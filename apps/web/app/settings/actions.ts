'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';
import { validateOrganizationBranding } from '@pasko-performance/core/product';
import { requireAppContext } from '../../lib/app-context';
import { isDemoWorkspace } from '../../lib/workspace';
import { resetDemoDatabase } from '@pasko-performance/db';
import { requireCurrentUser } from '../../lib/current-user';
import { createSeasonOnce, seasonDate } from '../../lib/seasons';

const str = (v: FormDataEntryValue | null) => String(v ?? '').trim();
const toDate = seasonDate;

export interface OrganizationFormState { error?: string; success?: string }

export async function updateOrganization(_: OrganizationFormState, formData: FormData): Promise<OrganizationFormState> {
  const context = await requireAppContext();
  const name = str(formData.get('name'));
  if (!name) {
    return { error: 'Название клуба обязательно.' };
  }

  let branding;
  try {
    branding = validateOrganizationBranding({
      shortName: str(formData.get('shortName')),
      logoAssetKey: str(formData.get('logoAssetKey')),
      primaryColor: str(formData.get('primaryColor')),
      secondaryColor: str(formData.get('secondaryColor')),
    });
  } catch {
    return { error: 'Введите цвет в формате #RRGGBB.' };
  }
  await prisma.organization.update({ where: { id: context.organizationId }, data: { name, ...branding } });
  revalidatePath('/settings');
  revalidatePath('/team', 'layout');
  return { success: 'Настройки клуба сохранены.' };
}

export async function updateTeam(formData: FormData): Promise<void> {
  const context = await requireAppContext();
  const name = str(formData.get('name'));
  if (!name) {
    console.error('updateTeam: название обязательно.');
    return;
  }

  await prisma.team.update({ where: { id: context.teamId }, data: { name } });
  revalidatePath('/settings');
  revalidatePath('/team', 'layout');
}

export async function updateSeason(formData: FormData): Promise<void> {
  const context = await requireAppContext();
  const name = str(formData.get('name'));
  const startDate = str(formData.get('startDate'));
  const endDate = str(formData.get('endDate'));

  if (!name) {
    console.error('updateSeason: название сезона обязательно.');
    return;
  }
  if (!startDate || !endDate) {
    console.error('updateSeason: укажите даты начала и окончания.');
    return;
  }

  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    console.error('updateSeason: некорректные даты.');
    return;
  }
  if (end < start) {
    console.error('updateSeason: окончание сезона не может быть раньше начала.');
    return;
  }

  await prisma.season.update({ where: { id: context.seasonId }, data: { name, startDate: start, endDate: end } });

  revalidatePath('/settings');
}

export async function createTeam(formData: FormData): Promise<void> {
  const context = await requireAppContext();
  const name = str(formData.get('name'));
  const code = str(formData.get('code')).toUpperCase();
  if (!name || !/^[A-Z0-9_-]{2,32}$/.test(code)) return;
  await prisma.team.create({ data: { name, code, organizationId: context.organizationId } });
  revalidatePath('/settings');
  revalidatePath('/context');
}

export async function createSeason(formData: FormData): Promise<void> {
  const context = await requireAppContext();
  const name = str(formData.get('name'));
  const start = toDate(str(formData.get('startDate')));
  const end = toDate(str(formData.get('endDate')));
  if (!name || !start || !end || end < start) return;
  await createSeasonOnce(prisma, context.teamId, name, start, end);
  revalidatePath('/settings');
  revalidatePath('/context');
}

export async function resetDemoData(formData: FormData): Promise<void> {
  if (isDemoWorkspace()) throw new Error('USE_DEMO_RESET_ACTION');
  await requireCurrentUser();
  await requireAppContext();
  if (String(formData.get('confirmation') ?? '') !== 'СБРОСИТЬ') throw new Error('RESET_NOT_CONFIRMED');
  // Удаляем рабочие данные, но сохраняем нормативы, справочник тестов и оборудование
  // Порядок: дети → родители (BodyComposition имеет FK на TestSession)
  await prisma.$transaction(async (tx) => {
    await tx.qCFlag.deleteMany();
    await tx.playerGoal.deleteMany();
    await tx.testResult.deleteMany();
    await tx.bodyComposition.deleteMany();
    await tx.testSession.deleteMany();
    await tx.player.deleteMany();
    await tx.importJob.deleteMany();
    await tx.auditLog.deleteMany();
  });

  revalidatePath('/', 'layout');
  revalidatePath('/players', 'layout');
  revalidatePath('/sessions', 'layout');
  revalidatePath('/settings');
}

export type DemoResetState = { error?: string; success?: string };
export async function resetDemoWorkspace(_: DemoResetState, formData: FormData): Promise<DemoResetState> {
  if (!isDemoWorkspace()) return { error: 'Сброс доступен только в демонстрационном пространстве.' };
  await requireAppContext();
  if (str(formData.get('confirmation')) !== 'СБРОСИТЬ ДЕМО') return { error: 'Введите точную строку подтверждения.' };
  try { await resetDemoDatabase(prisma); }
  catch { return { error: 'Не удалось восстановить демонстрационные данные. Данные клуба не изменены.' }; }
  revalidatePath('/', 'layout');
  return { success: 'Исходные демо-данные восстановлены.' };
}
