import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export const SYSTEM_REFERENCE_CODE = 'PASKO_VOLLEYBALL_MEN_ELITE_V1';

export type ReferenceEntryWithTest = Prisma.NormEntryGetPayload<{
  include: { test: { include: { categoryRel: true } }; sources: { include: { source: true } } };
}>;

export async function loadTeamReferenceProfile(teamId: string) {
  const now = new Date();
  const team = await prisma.team.findFirst({ where: { id: teamId, deletedAt: null }, select: { organizationId: true, activeNormProfileId: true } });
  if (!team) return null;
  const eligibility = { deletedAt: null, status: 'ACTIVE' as const, OR: [{ scope: 'SYSTEM' as const }, { scope: 'ORGANIZATION' as const, organizationId: team.organizationId }] };
  const profile = team.activeNormProfileId
    ? await prisma.normProfile.findFirst({ where: { id: team.activeNormProfileId, ...eligibility }, include: { baseProfile: true, entries: { where: { deletedAt: null, AND: [{ OR: [{ validFrom: null }, { validFrom: { lte: now } }] }, { OR: [{ validUntil: null }, { validUntil: { gte: now } }] }] }, orderBy: { validFrom: 'asc' }, include: { test: { include: { categoryRel: true } }, sources: { include: { source: true } } } } } })
    : await prisma.normProfile.findFirst({ where: { ...eligibility, scope: 'SYSTEM', isDefaultForVertical: true }, include: { baseProfile: true, entries: { where: { deletedAt: null, AND: [{ OR: [{ validFrom: null }, { validFrom: { lte: now } }] }, { OR: [{ validUntil: null }, { validUntil: { gte: now } }] }] }, orderBy: { validFrom: 'asc' }, include: { test: { include: { categoryRel: true } }, sources: { include: { source: true } } } } } });
  return profile ? { ...profile, explicitlySelected: team.activeNormProfileId === profile.id } : null;
}

export function referenceEntryMap(entries: ReferenceEntryWithTest[]) {
  return new Map(entries.map((entry) => [`${entry.position ?? '*'}|${entry.test.code}`, entry]));
}

export function resolveReferenceEntry(map: Map<string, ReferenceEntryWithTest>, testCode: string, position?: string | null) {
  return (position ? map.get(`${position}|${testCode}`) : undefined) ?? map.get(`*|${testCode}`) ?? null;
}

export { empiricalAnchors } from './reference-policy';
