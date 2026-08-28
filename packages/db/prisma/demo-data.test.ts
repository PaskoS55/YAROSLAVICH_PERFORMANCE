import { describe, expect, it, vi } from 'vitest';
import { assertDemoDatabaseUrl, initializeDemoDatabase, resetDemoDatabase, PASKO_DEMO_DATABASE, PASKO_DEMO_DATASET_CODE, PASKO_DEMO_DATASET_VERSION } from './demo-data';

describe('isolated demo database identity', () => {
  it.each([initializeDemoDatabase, resetDemoDatabase])('rejects a production connection even with a forged Demo URL', async operation => {
    const readMarker = vi.fn();
    const db = { $queryRaw: vi.fn(async () => [{ name: 'pasko_performance' }]), auditLog: { findUnique: readMarker } };
    await expect(operation(db as never, 'postgresql://synthetic:synthetic@127.0.0.1/pasko_performance_demo')).rejects.toThrow('DEMO_DATABASE_IDENTITY_REJECTED');
    expect(readMarker).not.toHaveBeenCalled();
  });
  it('accepts only the exact canonical demo database', () => {
    expect(() => assertDemoDatabaseUrl(`postgresql://user:secret@127.0.0.1:5432/${PASKO_DEMO_DATABASE}`)).not.toThrow();
    for (const target of ['pasko_performance', 'other', 'pasko_performance_demo_suffix']) expect(() => assertDemoDatabaseUrl(`postgresql://user:secret@127.0.0.1:5432/${target}`)).toThrow('DEMO_DATABASE_IDENTITY_REJECTED');
    expect(() => assertDemoDatabaseUrl(undefined)).toThrow('DEMO_DATABASE_URL_MISSING');
  });
  it('uses a versioned canonical synthetic dataset identity', () => {
    expect(PASKO_DEMO_DATASET_CODE).toBe('PASKO_DEMO_VOLLEYBALL_V1');
    expect(PASKO_DEMO_DATASET_VERSION).toBe('1.0');
  });
});
