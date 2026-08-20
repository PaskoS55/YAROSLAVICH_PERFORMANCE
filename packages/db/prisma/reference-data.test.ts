import { describe, expect, it, vi } from 'vitest';
import { PRODUCT_TEST_SPECS, VOLLEYBALL_TEST_SPECS, seedReferenceData } from './reference-data';

describe('reference bootstrap', () => {
  it('contains product and volleyball definitions but no demo club data', () => {
    const serialized = JSON.stringify({ PRODUCT_TEST_SPECS, VOLLEYBALL_TEST_SPECS });
    expect(serialized).toContain('VB_APP');
    expect(serialized).not.toContain('Ярославич');
    expect(serialized).not.toContain('ДЕМО');
    expect(serialized).not.toContain('P001');
  });

  it('is idempotent by using only upserts', async () => {
    let id = 0;
    const tx = { testCategory: { upsert: vi.fn(async ({ where }: { where: { code: string } }) => ({ id: `cat-${where.code}` })) }, test: { upsert: vi.fn(async ({ where }: { where: { code: string } }) => ({ id: `test-${++id}`, code: where.code })) } };
    await seedReferenceData(tx as never); await seedReferenceData(tx as never);
    expect(tx.testCategory.upsert).toHaveBeenCalledTimes(14);
    expect(tx.test.upsert).toHaveBeenCalledTimes(32);
  });
});
