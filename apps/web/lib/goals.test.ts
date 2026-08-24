import { describe, expect, it, vi } from 'vitest';
import { goalReached, syncGoalsForResult } from './goals';

describe('goal direction rules', () => {
  it('supports higher, lower and leaves contextual goals manual', () => {
    expect(goalReached('HIGHER_IS_BETTER', 50, 51)).toBe(true);
    expect(goalReached('LOWER_IS_BETTER', 5, 4.9)).toBe(true);
    expect(goalReached('CONTEXTUAL', 10, 10)).toBe(false);
  });
});

describe('goal downstream scoping', () => {
  it('recalculates from PASSED results in the active season only', async () => {
    const findResults = vi.fn(async () => [{ value: 51 }]);
    const updateGoal = vi.fn(async () => undefined);
    const tx = {
      test: { findUnique: vi.fn(async () => ({ direction: 'HIGHER_IS_BETTER' })) },
      playerGoal: {
        findMany: vi.fn(async () => [{ id: 'goal-a', targetValue: 50, achieved: false }]),
        update: updateGoal,
      },
      testResult: { findMany: findResults },
    };

    await syncGoalsForResult(tx as never, 'player-a', 'test-a', 'season-a');

    expect(findResults).toHaveBeenCalledWith({
      where: {
        playerId: 'player-a',
        testId: 'test-a',
        deletedAt: null,
        qcStatus: 'PASSED',
        testSession: { seasonId: 'season-a', deletedAt: null },
      },
      select: { value: true },
    });
    expect(updateGoal).toHaveBeenCalledWith({
      where: { id: 'goal-a' },
      data: { achieved: true, achievedAt: expect.any(Date) },
    });
  });
});
