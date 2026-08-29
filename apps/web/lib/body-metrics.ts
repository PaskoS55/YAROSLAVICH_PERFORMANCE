import type { BodyComposition, Prisma, TestResult } from '@prisma/client';

export const BODY_METRICS = {
  BC_MASS: { field: 'mass_kg', name: 'Масса тела', unit: 'kg' },
  BC_FAT: { field: 'fat_pct', name: 'Процент жира', unit: '%' },
  BC_FFM: { field: 'ffm_kg', name: 'Безжировая масса', unit: 'kg' },
} as const;
export type BodyMetricCode = keyof typeof BODY_METRICS;
export const isBodyMetric = (code: string): code is BodyMetricCode => Object.prototype.hasOwnProperty.call(BODY_METRICS, code);

export function bodyMetricConflict(snapshot: BodyComposition, code: BodyMetricCode, result: Pick<TestResult, 'value' | 'deletedAt' | 'playerId'> | null) {
  const value = snapshot[BODY_METRICS[code].field];
  return value !== null && (!result || result.deletedAt !== null || result.playerId !== snapshot.playerId || result.value !== value);
}

export async function lockMeasurementSession(tx: Prisma.TransactionClient, sessionId: string) {
  await tx.$queryRaw`SELECT id FROM test_sessions WHERE id = ${sessionId} FOR UPDATE`;
}

// Call BEFORE changing a TestResult, while holding the session lock. Legacy
// conflicts require the explicit resolution action, never a background winner.
export async function assertBodyMetricWritable(tx: Prisma.TransactionClient, sessionId: string, playerId: string, test: { id: string; code: string; unit: string }) {
  if (!isBodyMetric(test.code)) return;
  if (test.unit !== BODY_METRICS[test.code].unit) throw new Error('Единица BC-метрики несовместима со снимком состава тела.');
  const [snapshots, result] = await Promise.all([
    tx.bodyComposition.findMany({ where: { testSessionId: sessionId, deletedAt: null } }),
    tx.testResult.findUnique({ where: { testSessionId_testId: { testSessionId: sessionId, testId: test.id } } }),
  ]);
  if (snapshots.some(snapshot => snapshot.playerId !== playerId || bodyMetricConflict(snapshot, test.code as BodyMetricCode, result))) {
    throw new Error('BODY_CONFLICT: сначала разрешите расхождение на странице «Состав тела».');
  }
}

// Projection only. Values are supplied by the TestResult write, never derived
// from body mass/fat (FFM remains directly measured/entered).
export async function projectBodyMetric(tx: Prisma.TransactionClient, sessionId: string, playerId: string, code: string, value: number) {
  if (!isBodyMetric(code)) return;
  const data = { [BODY_METRICS[code].field]: value };
  const count = await tx.bodyComposition.count({ where: { testSessionId: sessionId, playerId, deletedAt: null } });
  if (count) await tx.bodyComposition.updateMany({ where: { testSessionId: sessionId, playerId, deletedAt: null }, data });
  else await tx.bodyComposition.create({ data: { testSessionId: sessionId, playerId, ...data } });
}
