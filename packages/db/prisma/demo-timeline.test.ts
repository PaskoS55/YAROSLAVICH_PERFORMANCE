import { describe, expect, it } from 'vitest';
import { demoTimeline, timelineMetadata, DEMO_CHECKPOINT_OFFSETS } from './demo-timeline';

describe('persistent Demo timeline construction', () => {
  it.each(['2026-08-28T00:01:00', '2026-01-01T00:00:00', '2028-03-01T23:59:00', '2026-03-29T00:01:00', '2026-10-25T00:01:00'])('uses four historical calendar checkpoints at %s', input => {
    const now = new Date(input);
    const t = demoTimeline(now);
    expect(t.anchor.getTime()).toBeLessThan(now.getTime());
    expect(t.checkpoints).toHaveLength(4);
    expect(t.checkpoints.at(-1)).toEqual(t.anchor);
    for (const [i, date] of t.checkpoints.entries()) {
      const expected = new Date(t.anchor); expected.setDate(expected.getDate() + DEMO_CHECKPOINT_OFFSETS[i]);
      expect(date).toEqual(expected);
      expect(date.getTime()).toBeLessThanOrEqual(t.anchor.getTime());
      expect(date >= t.season.startDate && date <= t.season.endDate).toBe(true);
    }
    expect(timelineMetadata(now).anchor).toBe(t.anchor.toISOString());
    expect(demoTimeline(now)).toEqual(t);
  });
  it('a later explicit reset gets a new anchor; stored metadata remains unchanged', () => {
    const stored = timelineMetadata(new Date('2026-08-28T12:00:00'));
    const next = timelineMetadata(new Date('2026-09-01T12:00:00'));
    expect(stored.anchor).not.toBe(next.anchor);
    expect(stored).toEqual(timelineMetadata(new Date('2026-08-28T12:00:00')));
  });
  it('rejects invalid clock and permits future deadlines, never future achievement', () => {
    expect(() => demoTimeline(new Date(NaN))).toThrow('INVALID_DEMO_CLOCK');
    const now = new Date('2026-08-28T12:00:00'); const t = demoTimeline(now);
    expect(t.goalDeadlines.every(d => d > now)).toBe(true);
    expect(t.anchor < now).toBe(true);
  });
});
