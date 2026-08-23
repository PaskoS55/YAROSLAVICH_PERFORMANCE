import { describe, expect, it, vi } from 'vitest';
import { PASKO_REFERENCE_V1_ENTRIES, PRODUCT_TEST_SPECS, VOLLEYBALL_TEST_SPECS, seedReferenceData } from './reference-data';

describe('reference bootstrap', () => {
  it('contains product and volleyball definitions but no demo club data', () => {
    const serialized = JSON.stringify({ PRODUCT_TEST_SPECS, VOLLEYBALL_TEST_SPECS });
    expect(serialized).toContain('VB_APP');
    expect(serialized).not.toContain('Ярославич');
    expect(serialized).not.toContain('ДЕМО');
    expect(serialized).not.toContain('P001');
  });

  it('is idempotent by using only upserts', async () => {
    const entries = new Map<string, { id: string }>();
    const tx = {
      testCategory: { upsert: vi.fn(async ({ where }: { where: { code: string } }) => ({ id: `cat-${where.code}` })) },
      test: { upsert: vi.fn(async ({ where }: { where: { code: string } }) => ({ id: `test-${where.code}`, code: where.code })) },
      normProfile: { upsert: vi.fn(async () => ({ id: 'profile-v1' })) },
      referenceSource: { upsert: vi.fn(async ({ where }: { where: { code: string } }) => ({ id: `source-${where.code}` })) },
      normEntry: {
        findFirst: vi.fn(async ({ where }: any) => entries.get(`${where.testId}|${where.position ?? '*'}`) ?? null),
        create: vi.fn(async ({ data }: any) => { const row = { id: `entry-${entries.size}` }; entries.set(`${data.testId}|${data.position ?? '*'}`, row); return row; }),
      },
      normEntrySource: { upsert: vi.fn(async () => ({})) },
    };
    await seedReferenceData(tx as never); await seedReferenceData(tx as never);
    expect(tx.testCategory.upsert).toHaveBeenCalledTimes(14);
    expect(tx.test.upsert).toHaveBeenCalledTimes(32);
    expect(entries.size).toBe(26);
  });

  it('covers all 16 tests without manufacturing literature percentiles', () => {
    expect(new Set(PASKO_REFERENCE_V1_ENTRIES.map((entry) => entry.testCode)).size).toBe(16);
    expect(PASKO_REFERENCE_V1_ENTRIES).toHaveLength(26);
    for (const entry of PASKO_REFERENCE_V1_ENTRIES) {
      expect(entry).not.toHaveProperty('p10'); expect(entry).not.toHaveProperty('p90');
    }
  });

  it('preserves the published and explicitly derived values', () => {
    const find = (testCode: string, position?: string) => PASKO_REFERENCE_V1_ENTRIES.find((entry) => entry.testCode === testCode && entry.position === position)!;
    expect(find('PWR_CMJ')).toMatchObject({ mean: 42, sd: 6, sampleSize: 45, evidenceLevel: 'MODERATE' });
    expect(find('VB_APP', 'middle_blocker')).toMatchObject({ mean: 349, sd: 14, evidenceLevel: 'HIGH' });
    expect(find('VB_BLOCK', 'opposite')).toMatchObject({ mean: 332, sd: 9, evidenceLevel: 'HIGH' });
    expect(find('BC_FAT')).toMatchObject({ mean: 12.8, ciLow: 11.9, ciHigh: 13.8, interpretationType: 'POOLED_ESTIMATE' });
    expect(find('AGI_505').interpretationType).toBe('NO_REFERENCE');
    expect(find('STR_PULL').interpretationType).toBe('NO_REFERENCE');
    for (const code of ['SPD_10', 'SPD_20', 'AGI_TTEST']) expect(find(code)).toMatchObject({ derivedByPasko: true, derivedApproximate: true, sourceCode: 'CIN_2021_PRO_VOLLEYBALL' });
  });
});
