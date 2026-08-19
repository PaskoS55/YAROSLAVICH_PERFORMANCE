import { describe, expect, it } from 'vitest';
import {
  calculateDelta,
  calculatePB,
  normalizeScore,
  qcCheckValue,
} from './calculations';

const anchors = {
  anchor10: 10,
  anchor25: 20,
  anchor50: 30,
  anchor75: 40,
  anchor90: 50,
};

describe('performance calculations', () => {
  it('normalizes both result directions', () => {
    expect(normalizeScore(30, anchors, 'HIGHER_IS_BETTER').score).toBe(50);
    expect(normalizeScore(30, anchors, 'LOWER_IS_BETTER').score).toBe(50);
    expect(normalizeScore(50, anchors, 'LOWER_IS_BETTER').score).toBe(0);
  });

  it('classifies meaningful improvement for lower-is-better results', () => {
    expect(calculateDelta(9.5, 10, 'LOWER_IS_BETTER', 0.2)).toEqual({
      delta: -0.5,
      performanceDelta: 0.5,
      changeStatus: 'SIGNIFICANT_IMPROVEMENT',
    });
  });

  it('rejects values outside QC bounds', () => {
    expect(qcCheckValue(101, 0, 100).status).toBe('FAILED');
    expect(qcCheckValue(100, 0, 100).status).toBe('PASSED');
  });

  it('detects a new personal best in either direction', () => {
    const history = [{ testCode: 'T', value: 10, date: new Date('2026-01-01') }];
    expect(calculatePB('P', 'T', 11, history, 'HIGHER_IS_BETTER').isNewPB).toBe(true);
    expect(calculatePB('P', 'T', 9, history, 'LOWER_IS_BETTER').isNewPB).toBe(true);
  });
});
