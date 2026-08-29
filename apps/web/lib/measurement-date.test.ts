import { describe, expect, it } from 'vitest';
import { measurementDay } from './measurement-date';

describe('date-only historical measurements', () => {
  it('today is historical at 00:00 and 23:59 and replays have stable identity', () => {
    const { start, end } = measurementDay('2026-08-28');
    for (const now of [new Date(2026, 7, 28, 0, 0), new Date(2026, 7, 28, 23, 59)]) {
      expect(start <= now && now < end).toBe(true);
    }
    expect(start.getDate()).toBe(28);
    expect(start.getMonth()).toBe(7);
    expect(measurementDay('2026-08-28')).toEqual({ start, end });
    expect(measurementDay('2026-08-29').start).toEqual(end);
  });
  it('rejects overflowing and malformed calendar dates instead of rolling them forward', () => {
    for (const input of ['', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-08-00', 'NaN', '2026-08-28T12:00:00Z']) {
      expect(() => measurementDay(input)).toThrow('Некорректная дата');
    }
    expect(measurementDay('2024-02-29').end.getDate()).toBe(1);
  });
});
