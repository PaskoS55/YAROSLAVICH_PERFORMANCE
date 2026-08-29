import { describe, expect, it } from 'vitest';
import type { Test } from '@prisma/client';
import { PRODUCT_TEST_SPECS, VOLLEYBALL_TEST_SPECS } from '../../../packages/db/prisma/reference-data';
import { historicalSessions, latestMeasurements, personalBests, type MeasurementSession } from './measurements';

const cutoff = new Date('2026-08-28T12:00:00Z');
const specs = [...PRODUCT_TEST_SPECS, ...VOLLEYBALL_TEST_SPECS];
const session = (id: string, at: string, value: number, test: Test): MeasurementSession => ({
  id, DateTime: new Date(at), createdAt: new Date(at), deletedAt: null,
  testResults: [{ id: `${id}-r`, testId: test.id, value, qcStatus: 'PASSED', deletedAt: null, test }],
});

describe('every shipped metric: canonical historical latest / PB', () => {
  it('covers all sixteen canonical metric codes without a copied subset', () => {
    expect(specs).toHaveLength(16);
    expect(new Set(specs.map(s => s.code)).size).toBe(16);
  });
  it.each(specs)('$code excludes future, failed and archived rows; PB is reference-independent', spec => {
    const test = { ...spec, id: spec.code, categoryId: spec.category, deletedAt: null } as unknown as Test;
    const center = (spec.qcMin + spec.qcMax) / 2;
    const old = session('old', '2026-08-01', center, test);
    const latest = session('latest', '2026-08-28T11:00:00Z', center + 0.1, test);
    const future = session('future', '2026-08-29', 999, test);
    const failed = session('failed', '2026-08-28T11:59:59Z', 888, test);
    failed.testResults[0].qcStatus = 'FAILED';
    const deleted = session('deleted', '2026-08-28T11:59:58Z', 777, test);
    deleted.deletedAt = cutoff;
    const archivedResult = session('archived-result', '2026-08-28T11:59:57Z', 666, test);
    archivedResult.testResults[0].deletedAt = cutoff;
    const rows = [future, old, archivedResult, failed, latest, deleted];
    expect(latestMeasurements(rows, cutoff).get(test.id)?.value).toBe(center + 0.1);
    expect(latestMeasurements([...rows].reverse(), cutoff)).toEqual(latestMeasurements(rows, cutoff));
    const pb = personalBests(rows, cutoff).get(test.id);
    if (spec.direction === 'CONTEXTUAL') expect(pb).toBeUndefined();
    else expect(pb?.value).toBe(spec.direction === 'HIGHER_IS_BETTER' ? center + 0.1 : center);
  });
  it('uses identical deterministic tie-breaks and inclusive cutoff', () => {
    const test = { id: 't', direction: 'HIGHER_IS_BETTER' } as Test;
    const a = session('a', cutoff.toISOString(), 10, test);
    const b = session('b', cutoff.toISOString(), 20, test);
    expect(historicalSessions([a, b], cutoff).map(s => s.id)).toEqual(['b', 'a']);
    expect(latestMeasurements([a, b], cutoff).get('t')?.value).toBe(20);
    expect(latestMeasurements([b, a], cutoff).get('t')?.value).toBe(20);
  });
});
