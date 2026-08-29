import type { Test } from '@prisma/client';
import type { ProfileMetric } from './player-profile';

export type MeasurementSession = {
  id: string;
  DateTime: Date;
  createdAt: Date;
  deletedAt: Date | null;
  testResults: {
    id: string;
    testId: string;
    value: number;
    qcStatus: string;
    deletedAt: Date | null;
    test: Test;
  }[];
};

// Measurement time is authoritative. Equal-time sessions use insertion time,
// then stable id, so all screens select the same row regardless of query order.
export function compareMeasurementSessions(a: Pick<MeasurementSession, 'id' | 'DateTime' | 'createdAt'>, b: Pick<MeasurementSession, 'id' | 'DateTime' | 'createdAt'>) {
  return b.DateTime.getTime() - a.DateTime.getTime()
    || b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id);
}

export function historicalSessions<T extends MeasurementSession>(sessions: readonly T[], cutoff: Date): T[] {
  return sessions.filter(s => !s.deletedAt && s.DateTime <= cutoff).sort(compareMeasurementSessions);
}

export function latestMeasurements(sessions: readonly MeasurementSession[], cutoff: Date) {
  const latest = new Map<string, ProfileMetric & { alertBelow: number | null; alertAbove: number | null }>();
  for (const session of historicalSessions(sessions, cutoff)) {
    for (const result of session.testResults) {
      if (result.deletedAt || result.qcStatus !== 'PASSED' || !Number.isFinite(result.value) || latest.has(result.testId)) continue;
      latest.set(result.testId, { ...result.test, testId: result.testId, value: result.value, measuredAt: session.DateTime });
    }
  }
  return latest;
}

export function personalBests(sessions: readonly MeasurementSession[], cutoff: Date) {
  const best = new Map<string, { name: string; unit: string; value: number; date: Date }>();
  for (const session of historicalSessions(sessions, cutoff).reverse()) {
    for (const result of session.testResults) {
      if (result.deletedAt || result.qcStatus !== 'PASSED' || !Number.isFinite(result.value) || result.test.direction === 'CONTEXTUAL') continue;
      const current = best.get(result.testId);
      if (!current || (result.test.direction === 'HIGHER_IS_BETTER' ? result.value > current.value : result.value < current.value)) {
        best.set(result.testId, { name: result.test.name, unit: result.test.unit, value: result.value, date: session.DateTime });
      }
    }
  }
  return best;
}
