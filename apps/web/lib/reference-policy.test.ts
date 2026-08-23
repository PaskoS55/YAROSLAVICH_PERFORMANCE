import { describe, expect, it } from 'vitest';
import { canAssignReferenceProfile, canMutateReferenceProfile, canReadReferenceProfile, empiricalAnchors, validateReferenceFields } from './reference-policy';

describe('reference profile policy', () => {
  it('keeps system profiles immutable and isolates organization profiles', () => {
    expect(canMutateReferenceProfile('SYSTEM', null, 'org-a')).toBe(false);
    expect(canMutateReferenceProfile('INSTALLATION_LEGACY', null, 'org-a')).toBe(false);
    expect(canMutateReferenceProfile('ORGANIZATION', 'org-a', 'org-a')).toBe(true);
    expect(canMutateReferenceProfile('ORGANIZATION', 'org-a', 'org-b')).toBe(false);
    expect(canReadReferenceProfile('SYSTEM', null, 'org-b')).toBe(true);
    expect(canReadReferenceProfile('ORGANIZATION', 'org-a', 'org-b')).toBe(false);
  });

  it('allows assignment only for active system or same-organization profiles', () => {
    const active = { status: 'ACTIVE', deletedAt: null };
    expect(canAssignReferenceProfile({ ...active, scope: 'SYSTEM', organizationId: null }, 'org-b')).toBe(true);
    expect(canAssignReferenceProfile({ ...active, scope: 'ORGANIZATION', organizationId: 'org-a' }, 'org-a')).toBe(true);
    expect(canAssignReferenceProfile({ ...active, scope: 'ORGANIZATION', organizationId: 'org-a' }, 'org-b')).toBe(false);
    expect(canAssignReferenceProfile({ ...active, scope: 'INSTALLATION_LEGACY', organizationId: null }, 'org-a')).toBe(false);
    expect(canAssignReferenceProfile({ status: 'ARCHIVED', deletedAt: null, scope: 'SYSTEM', organizationId: null }, 'org-a')).toBe(false);
  });

  it('never turns literature or contextual entries into percentile anchors', () => {
    const blank = { p10: null, p25: null, p50: null, p75: null, p90: null };
    expect(empiricalAnchors({ interpretationType: 'PUBLISHED_DISTRIBUTION', ...blank })).toBeNull();
    expect(empiricalAnchors({ interpretationType: 'POOLED_ESTIMATE', ...blank })).toBeNull();
    expect(empiricalAnchors({ interpretationType: 'CONTEXT_ONLY', ...blank })).toBeNull();
    expect(empiricalAnchors({ interpretationType: 'NO_REFERENCE', ...blank })).toBeNull();
    expect(empiricalAnchors({ interpretationType: 'EMPIRICAL_PERCENTILE', p10: 1, p25: 2, p50: 3, p75: 4, p90: 5 })).toEqual({ p10: 1, p25: 2, p50: 3, p75: 4, p90: 5 });
  });

  it('rejects scientifically impossible mixed field combinations', () => {
    expect(validateReferenceFields({ interpretationType: 'PUBLISHED_DISTRIBUTION', mean: 42, sd: 6, p50: 42 })).toMatch(/Перцентили/);
    expect(validateReferenceFields({ interpretationType: 'NO_REFERENCE', mean: 1 })).toMatch(/не должна/);
    expect(validateReferenceFields({ interpretationType: 'POOLED_ESTIMATE', mean: 12.8, ciLow: 11.9, ciHigh: 13.8 })).toBeNull();
  });
});
