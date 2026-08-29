import { describe, expect, it, vi } from 'vitest';
import { assertBodyMetricWritable, bodyMetricConflict, projectBodyMetric } from './body-metrics';
import type { BodyComposition } from '@prisma/client';

const snapshot = { playerId: 'p', mass_kg: 92, fat_pct: 15, ffm_kg: 78.2 } as BodyComposition;
describe('canonical body metric projection', () => {
  it('detects exact-session value/missing/deleted/wrong-player conflicts, not absent snapshot fields', () => {
    const result = { playerId: 'p', value: 90, deletedAt: null };
    expect(bodyMetricConflict(snapshot, 'BC_MASS', result)).toBe(true);
    expect(bodyMetricConflict(snapshot, 'BC_MASS', { ...result, value: 92 })).toBe(false);
    expect(bodyMetricConflict(snapshot, 'BC_MASS', null)).toBe(true);
    expect(bodyMetricConflict(snapshot, 'BC_MASS', { ...result, value: 92, playerId: 'foreign' })).toBe(true);
    expect(bodyMetricConflict(snapshot, 'BC_MASS', { ...result, value: 92, deletedAt: new Date() })).toBe(true);
    expect(bodyMetricConflict({ ...snapshot, mass_kg: null }, 'BC_MASS', result)).toBe(false);
  });
  it('refuses ordinary writes over legacy conflicts without modifying either value', async () => {
    const tx = { bodyComposition: { findMany: vi.fn(async () => [snapshot]) }, testResult: { findUnique: vi.fn(async () => ({ playerId: 'p', value: 90, deletedAt: null })) } };
    await expect(assertBodyMetricWritable(tx as never, 'session', 'p', { id: 'mass', code: 'BC_MASS', unit: 'kg' })).rejects.toThrow('BODY_CONFLICT');
    expect(tx.bodyComposition.findMany).toHaveBeenCalledWith({ where: { testSessionId: 'session', deletedAt: null } });
    expect(tx.testResult.findUnique).toHaveBeenCalledWith({ where: { testSessionId_testId: { testSessionId: 'session', testId: 'mass' } } });
  });
  it.each([['BC_MASS','mass_kg',92],['BC_FAT','fat_pct',15],['BC_FFM','ffm_kg',78.2]] as const)('projects %s directly without deriving other metrics', async (code, field, value) => {
    const updateMany = vi.fn();
    await projectBodyMetric({ bodyComposition: { count: async () => 1, updateMany } } as never,'s','p',code,value);
    expect(updateMany).toHaveBeenCalledWith({ where: { testSessionId:'s',playerId:'p',deletedAt:null },data:{[field]:value} });
  });
  it('creates a partial snapshot only for the supplied canonical metric', async () => {
    const create=vi.fn();
    await projectBodyMetric({bodyComposition:{count:async()=>0,create}} as never,'s','p','BC_FAT',15);
    expect(create).toHaveBeenCalledWith({data:{testSessionId:'s',playerId:'p',fat_pct:15}});
    await projectBodyMetric({} as never,'s','p','PWR_CMJ',50);
    expect(create).toHaveBeenCalledOnce();
  });
});
