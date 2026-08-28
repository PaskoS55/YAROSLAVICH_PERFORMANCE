import type { NormProfile } from '@prisma/client';
import type { ReferenceEntryWithTest } from './references';
import { computePercentile } from './analytics';
import { empiricalAnchors } from './reference-policy';

export const PROFILE_CONFIRMATION_ACTION = 'REFERENCE_PROFILE_COMPATIBILITY_CONFIRMED';
type Profile = Pick<NormProfile, 'id' | 'version' | 'sport' | 'sex' | 'ageGroup' | 'level'>;
export function profileConfirmation(profile: Profile) {
  return { profileId: profile.id, version: profile.version, sport: profile.sport, sex: profile.sex, ageGroup: profile.ageGroup, level: profile.level };
}
export function matchesProfileConfirmation(value: unknown, profile: Profile) {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return Object.entries(profileConfirmation(profile)).every(([key, expected]) => record[key] === expected);
}

export type ProfileMetric = { testId: string; code: string; name: string; unit: string; value: number; direction: string; categoryId: string | null; measuredAt: Date };
export type ProfileScore = { raw: number; kind: 'EMPIRICAL_PERCENTILE' | 'STANDARDIZED'; description: string };

export function scoreProfileMetric(metric: ProfileMetric, entry: ReferenceEntryWithTest | null, profile: Profile | null, player: { position: string; birthDate: Date | null }, confirmed: boolean): ProfileScore | null {
  if (!entry || !profile || entry.profileId !== profile.id || entry.testId !== metric.testId || entry.test.code !== metric.code || entry.test.unit !== metric.unit || (entry.position !== null && entry.position !== player.position)) return null;
  if (!Number.isFinite(metric.value)) return null;
  if (entry.interpretationType === 'EMPIRICAL_PERCENTILE') {
    // Existing interpolation and direction semantics are intentionally unchanged.
    const raw = computePercentile(metric.value, empiricalAnchors(entry), metric.direction);
    return raw === null ? null : { raw, kind: 'EMPIRICAL_PERCENTILE', description: 'Эмпирический перцентиль' };
  }
  if (entry.interpretationType !== 'PUBLISHED_DISTRIBUTION' || !confirmed || profile.sport !== 'VOLLEYBALL') return null;
  if (!['HIGHER_IS_BETTER', 'LOWER_IS_BETTER'].includes(metric.direction)) return null;
  if (entry.mean === null || entry.sd === null || !Number.isFinite(entry.mean) || !Number.isFinite(entry.sd) || entry.sd <= 0) return null;
  if (!profile.version || (!entry.sourceText?.trim() && entry.sources.length === 0)) return null;
  if (profile.ageGroup !== 'UNSPECIFIED') {
    if (!player.birthDate || !Number.isFinite(player.birthDate.getTime()) || !Number.isFinite(metric.measuredAt.getTime()) || player.birthDate > metric.measuredAt) return null;
    const adultAt = new Date(player.birthDate); adultAt.setUTCFullYear(adultAt.getUTCFullYear() + 18);
    if ((profile.ageGroup === 'ADULT') !== (metric.measuredAt >= adultAt)) return null;
  }
  const z = (metric.direction === 'LOWER_IS_BETTER' ? entry.mean - metric.value : metric.value - entry.mean) / entry.sd;
  const raw = 50 + 10 * z;
  if (!Number.isFinite(raw)) return null;
  return { raw, kind: 'STANDARDIZED', description: 'Стандартизированный балл по опубликованным среднему и SD' };
}

export function aggregateProfileScores(metrics: { categoryId: string | null; score: ProfileScore | null; name: string }[]) {
  const groups = new Map<string, { sum: number; count: number; descriptions: string[] }>();
  for (const metric of metrics) {
    if (!metric.categoryId || !metric.score) continue;
    const group = groups.get(metric.categoryId) ?? { sum: 0, count: 0, descriptions: [] };
    group.sum += metric.score.raw; group.count++;
    group.descriptions.push(`${metric.name}: ${metric.score.description} — ${metric.score.raw.toFixed(2)}`);
    groups.set(metric.categoryId, group);
  }
  return groups;
}

export function profileHighlights<T extends { score: number }>(categories: T[]) {
  return { strengths: categories.filter(c => c.score >= 60).sort((a,b) => b.score-a.score), zones: categories.filter(c => c.score <= 40).sort((a,b) => a.score-b.score) };
}
