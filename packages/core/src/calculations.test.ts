import { describe, expect, it } from 'vitest';
import {
  calculateDelta,
  calculateGoalGap,
  calculatePB,
  normalizeScore,
  qcCheckValue,
} from './calculations';

const anchors = {
  p10: 10,
  p25: 20,
  p50: 30,
  p75: 40,
  p90: 50,
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

  it.each(['BC_FAT', 'BC_FFM', 'BC_MASS', 'MOB_OHS'])('keeps contextual test %s directionally neutral', (testCode) => {
    const history = [{ testCode, value: 10, date: new Date('2026-01-01') }];
    expect(calculateDelta(12, 10, 'CONTEXTUAL', 0.1)).toEqual({
      delta: 2,
      performanceDelta: null,
      changeStatus: 'NO_CHANGE',
    });
    expect(calculatePB('P', testCode, 12, history, 'CONTEXTUAL')).toEqual({
      currentValue: 12,
      pbValue: null,
      isNewPB: false,
      improvement: null,
      relativeImprovement: null,
    });
    expect(calculateGoalGap(12, 15, 'CONTEXTUAL')).toEqual({
      currentValue: 12,
      targetValue: 15,
      gap: null,
      progressPercentage: null,
    });
  });

  it('preserves directional goal-gap behavior', () => {
    expect(calculateGoalGap(8, 10, 'HIGHER_IS_BETTER')).toEqual({ currentValue: 8, targetValue: 10, gap: 2, progressPercentage: 80 });
    expect(calculateGoalGap(10, 8, 'LOWER_IS_BETTER')).toEqual({ currentValue: 10, targetValue: 8, gap: 2, progressPercentage: 0 });
  });
});
