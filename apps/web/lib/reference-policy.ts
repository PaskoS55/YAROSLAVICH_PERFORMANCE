import type { NormEntry, NormInterpretationType, NormProfileScope } from '@prisma/client';

export function canReadReferenceProfile(scope: NormProfileScope, profileOrganizationId: string | null, organizationId: string) {
  return scope === 'SYSTEM' || scope === 'INSTALLATION_LEGACY' || (scope === 'ORGANIZATION' && profileOrganizationId === organizationId);
}
export function canMutateReferenceProfile(scope: NormProfileScope, profileOrganizationId: string | null, organizationId: string) {
  return scope === 'ORGANIZATION' && profileOrganizationId === organizationId;
}
export function canAssignReferenceProfile(profile: { scope: NormProfileScope; organizationId: string | null; status: string; deletedAt: Date | null }, organizationId: string) {
  return profile.status === 'ACTIVE' && profile.deletedAt === null && (profile.scope === 'SYSTEM' || (profile.scope === 'ORGANIZATION' && profile.organizationId === organizationId));
}

export function validateReferenceFields(input: Partial<NormEntry> & { interpretationType: NormInterpretationType }): string | null {
  const percentiles = [input.p10, input.p25, input.p50, input.p75, input.p90];
  const anyPercentile = percentiles.some((value) => value != null);
  const anyDistribution = input.mean != null || input.sd != null || input.ciLow != null || input.ciHigh != null;
  const anyRange = input.referenceLow != null || input.referenceHigh != null;
  if (input.interpretationType === 'EMPIRICAL_PERCENTILE') {
    if (percentiles.some((value) => value == null || !Number.isFinite(value))) return 'Для эмпирических перцентилей необходимы P10, P25, P50, P75 и P90.';
    if (anyDistribution || anyRange) return 'Перцентильная запись не должна смешиваться со средним, CI или диапазоном.';
  } else if (anyPercentile) return 'Перцентили разрешены только для фактически опубликованного эмпирического распределения.';
  if (input.interpretationType === 'REFERENCE_RANGE' && (input.referenceLow == null || input.referenceHigh == null)) return 'Для референсного диапазона нужны нижняя и верхняя границы.';
  if (input.interpretationType === 'POOLED_ESTIMATE' && input.mean == null) return 'Для обобщённой оценки необходимо среднее.';
  if (input.interpretationType === 'NO_REFERENCE' && (anyDistribution || anyRange || anyPercentile)) return 'Запись без референса не должна содержать числовую классификацию.';
  return null;
}

export function empiricalAnchors(entry: Pick<NormEntry, 'interpretationType' | 'p10' | 'p25' | 'p50' | 'p75' | 'p90'> | null) {
  if (!entry || entry.interpretationType !== 'EMPIRICAL_PERCENTILE') return null;
  const { p10, p25, p50, p75, p90 } = entry;
  return [p10, p25, p50, p75, p90].every((value) => value != null && Number.isFinite(value)) ? { p10: p10!, p25: p25!, p50: p50!, p75: p75!, p90: p90! } : null;
}
