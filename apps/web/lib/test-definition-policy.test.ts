import { describe, expect, it } from 'vitest';
import { changesReferencedMetricIdentity } from './test-definition-policy';

const current = { unit: 'cm', direction: 'HIGHER_IS_BETTER', categoryId: 'power' };

describe('referenced metric identity', () => {
  it('allows descriptive edits without changing its scientific identity', () => {
    expect(changesReferencedMetricIdentity(current, { ...current })).toBe(false);
  });
  it.each([
    { ...current, unit: 'm' },
    { ...current, direction: 'LOWER_IS_BETTER' },
    { ...current, categoryId: 'speed' },
  ])('blocks unit, direction and category reinterpretation: $unit/$direction/$categoryId', next => {
    expect(changesReferencedMetricIdentity(current, next)).toBe(true);
  });
});
