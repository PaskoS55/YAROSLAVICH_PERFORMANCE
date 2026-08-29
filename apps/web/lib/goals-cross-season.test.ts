import { describe, expect, it, vi } from 'vitest';
import { goalMeasurements, goalReached, syncGoalsForResult } from './goals';

const day = (n: number) => new Date(`2025-01-${String(n).padStart(2, '0')}T12:00:00Z`);
const row = (value: number, n: number, playerId = 'p') => ({ playerId, testId: 't', value,
  testSession: { id: `s${n}`, playerId, DateTime: day(n), createdAt: day(n) } });
function fixture(direction = 'HIGHER_IS_BETTER', results = [row(51, 2), row(60, 3), row(40, 1)]) {
  const goal = { id: 'g', targetValue: 50, achieved: false, achievedAt: null as Date | null };
  const update = vi.fn(async ({ data }) => Object.assign(goal, data));
  const tx = {
    test: { findUnique: vi.fn(async () => ({ direction })) },
    playerGoal: { findMany: vi.fn(async () => [goal]), update },
    testResult: { findMany: vi.fn(async () => results) },
  };
  return { tx, goal, update };
}

describe('cross-season player goals', () => {
  it('keeps inclusive thresholds, contextual manual and nonfinite values ineligible', () => {
    expect(goalReached('HIGHER_IS_BETTER', 50, 50)).toBe(true);
    expect(goalReached('LOWER_IS_BETTER', 5, 5)).toBe(true);
    expect(goalReached('CONTEXTUAL', 10, 10)).toBe(false);
    expect(goalReached('HIGHER_IS_BETTER', 50, Infinity)).toBe(false);
    expect(goalReached('LOWER_IS_BETTER', NaN, 5)).toBe(false);
  });
  it('uses the first satisfying measurement, never the recalculation clock', async () => {
    const { tx, goal } = fixture();
    await syncGoalsForResult(tx as never, 'p', 't', 'team');
    expect(goal).toMatchObject({ achieved: true, achievedAt: day(2) });
  });
  it('recalculation/season switching does not rewrite a correct achievement', async () => {
    const { tx, goal, update } = fixture();
    goal.achieved = true; goal.achievedAt = day(2);
    await syncGoalsForResult(tx as never, 'p', 't', 'team');
    await syncGoalsForResult(tx as never, 'p', 't', 'team');
    expect(update).not.toHaveBeenCalled();
  });
  it('corrects legacy recalculation-time timestamps to the measurement', async () => {
    const { tx, goal } = fixture(); goal.achieved = true; goal.achievedAt = day(9);
    await syncGoalsForResult(tx as never, 'p', 't', 'team');
    expect(goal.achievedAt).toEqual(day(2));
  });
  it('allows later-season lower-is-better achievement and retains the first qualifying date', async () => {
    const results = [row(60, 1)];
    const { tx, goal } = fixture('LOWER_IS_BETTER', results);
    await syncGoalsForResult(tx as never, 'p', 't', 'team');
    expect(goal.achieved).toBe(false);
    results.push(row(50, 2), row(40, 3));
    await syncGoalsForResult(tx as never, 'p', 't', 'team');
    expect(goal).toMatchObject({ achieved: true, achievedAt: day(2) });
  });
  it('invalidating the only qualifying result clears automatic achievement', async () => {
    const results = [row(51, 2)]; const { tx, goal } = fixture('HIGHER_IS_BETTER', results);
    await syncGoalsForResult(tx as never, 'p', 't', 'team');
    results.length = 0;
    await syncGoalsForResult(tx as never, 'p', 't', 'team');
    expect(goal).toMatchObject({ achieved: false, achievedAt: null });
  });
  it('does not overwrite an explicitly manual contextual goal', async () => {
    const { tx, goal, update } = fixture('CONTEXTUAL'); goal.achieved = true; goal.achievedAt = day(4);
    await syncGoalsForResult(tx as never, 'p', 't', 'team');
    expect(update).not.toHaveBeenCalled(); expect(tx.testResult.findMany).not.toHaveBeenCalled();
  });
  it('display uses the same measurement/creation/id tie order as other screens', async () => {
    const a = row(51, 2), b = row(52, 2), c = row(53, 2);
    a.testSession.id = 'a'; b.testSession.id = 'b'; c.testSession.createdAt = day(3);
    const { tx } = fixture('HIGHER_IS_BETTER', [a, b, c]);
    expect((await goalMeasurements(tx as never, ['p'], ['t'], 'team', day(9))).map(r => r.value)).toEqual([53, 52, 51]);
  });
  it('rejects inconsistent legacy player/session linkage and nonfinite stored values', async () => {
    const bad = row(99, 2); bad.testSession.playerId = 'other-player';
    const { tx } = fixture('HIGHER_IS_BETTER', [bad, row(Infinity, 2), row(40, 1)]);
    expect((await goalMeasurements(tx as never, ['p'], ['t'], 'team', day(9))).map(r => r.value)).toEqual([40]);
  });
});
