import { describe, expect, it } from 'vitest';
import type { ReferenceEntryWithTest } from './references';
import { aggregateProfileScores, matchesProfileConfirmation, profileConfirmation, profileHighlights, scoreProfileMetric, type ProfileMetric } from './player-profile';
import { computePercentile } from './analytics';
import { empiricalAnchors } from './reference-policy';

const profile = { id: 'ref', version: '1.0', sport: 'VOLLEYBALL', sex: 'MALE', ageGroup: 'ADULT', level: 'ELITE' } as const;
const player: { position: string; birthDate: Date | null } = { position: 'setter', birthDate: new Date('1990-01-01') };
const metric: ProfileMetric = { testId: 'cmj', code: 'PWR_CMJ', name: 'CMJ', unit: 'cm', value: 48, direction: 'HIGHER_IS_BETTER', categoryId: 'power', measuredAt: new Date('2026-08-01') };
const entry = { profileId: 'ref', testId: 'cmj', test: { code: 'PWR_CMJ', unit: 'cm' }, position: null, interpretationType: 'PUBLISHED_DISTRIBUTION', mean: 42, sd: 6, sourceText: 'Published source', sources: [], p10: null, p25: null, p50: null, p75: null, p90: null } as unknown as ReferenceEntryWithTest;
const score = (m = metric, e = entry, p = player, confirmed = true) => scoreProfileMetric(m, e, profile, p, confirmed);
describe('Player Profile standardized reference scores', () => {
  it('orients higher and lower metrics and retains unclipped raw scores', () => {
    expect(score()?.raw).toBe(60);
    expect(score({ ...metric, value: 36, direction: 'LOWER_IS_BETTER' })?.raw).toBe(60);
    expect(score({ ...metric, value: 108 })?.raw).toBe(160);
    expect(score({ ...metric, value: -24 })?.raw).toBe(-60);
    expect(score()?.description).toBe('Стандартизированный балл по опубликованным среднему и SD');
  });
  it('does not use pooled estimates, contextual results, absent provenance or invalid SD', () => {
    for (const sd of [0, -1, NaN, Infinity, null]) expect(score(metric, { ...entry, sd })).toBeNull();
    for (const interpretationType of ['POOLED_ESTIMATE','CONTEXT_ONLY','NO_REFERENCE','REFERENCE_RANGE'] as const) expect(score(metric, { ...entry, interpretationType })).toBeNull();
    expect(score({ ...metric, direction: 'CONTEXTUAL' })).toBeNull();
    expect(score({ ...metric, value: NaN })).toBeNull();
    expect(score(metric, { ...entry, sourceText: null })).toBeNull();
  });
  it('leaves empirical interpolation unchanged for both directions', () => {
    const empirical = { ...entry, interpretationType: 'EMPIRICAL_PERCENTILE' as const, p10: 10, p25: 25, p50: 50, p75: 75, p90: 90 };
    for (const direction of ['HIGHER_IS_BETTER','LOWER_IS_BETTER','CONTEXTUAL']) {
      for (const value of [0,10,20,50,81,100]) expect(score({ ...metric, direction, value }, empirical)?.raw ?? null).toBe(computePercentile(value, empiricalAnchors(empirical), direction));
    }
    expect(score(metric, empirical)?.description).toBe('Эмпирический перцентиль');
    expect(empiricalAnchors(entry)).toBeNull();
  });
  it('requires exact metric/unit/position/profile identity', () => {
    for (const mismatch of [{ testId: 'other' }, { unit: 'm' }, { code: 'VB_APP' }]) expect(score({ ...metric, ...mismatch })).toBeNull();
    expect(score(metric, { ...entry, profileId: 'other' })).toBeNull();
    expect(score(metric, { ...entry, position: 'libero' })).toBeNull();
    expect(score(metric, { ...entry, position: 'setter' })?.raw).toBe(60);
  });
  it('requires compatible confirmed metadata and age at the test date', () => {
    expect(score(metric, entry, player, false)).toBeNull();
    expect(score(metric, entry, { ...player, birthDate: null })).toBeNull();
    expect(score(metric, entry, { ...player, birthDate: new Date('2010-01-01') })).toBeNull();
    expect(score(metric, entry, { ...player, birthDate: new Date('2008-08-01') })?.raw).toBe(60);
    const confirmation = profileConfirmation(profile);
    expect(matchesProfileConfirmation(confirmation, profile)).toBe(true);
    for (const change of [{ sex: 'FEMALE' },{ ageGroup: 'YOUTH' },{ sport: 'OTHER' },{ version: '2.0' },{ profileId: 'other' }]) expect(matchesProfileConfirmation({ ...confirmation, ...change }, profile)).toBe(false);
  });
  it('aggregates partial categories without clipping or inventing strong/growth zones', () => {
    const groups = aggregateProfileScores([
      { categoryId: 'power', name: 'CMJ', score: score() },
      { categoryId: 'power', name: 'Missing', score: null },
      { categoryId: 'speed', name: 'Sprint', score: { raw: 39, kind: 'STANDARDIZED', description: 'Speed' } },
      { categoryId: 'other', name: 'Average', score: { raw: 50, kind: 'STANDARDIZED', description: 'Average' } },
    ]);
    expect(groups.get('power')).toMatchObject({ sum: 60, count: 1 });
    const cats = [...groups].map(([id,v]) => ({ id, score: v.sum/v.count }));
    expect(profileHighlights(cats).strengths.map(c=>c.id)).toEqual(['power']);
    expect(profileHighlights(cats).zones.map(c=>c.id)).toEqual(['speed']);
    expect(profileHighlights([{ score: 59.99 },{ score: 40.01 }])).toEqual({ strengths: [], zones: [] });
  });
});
