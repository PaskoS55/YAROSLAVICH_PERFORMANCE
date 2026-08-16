import type { Prisma } from '@prisma/client';

export function computeQcStatus(
  test: { qcMin: number | null; qcMax: number | null },
  value: number
): 'PASSED' | 'FAILED' {
  if (test.qcMin !== null && value < test.qcMin) return 'FAILED';
  if (test.qcMax !== null && value > test.qcMax) return 'FAILED';
  return 'PASSED';
}

export async function syncQcFlag(
  tx: Prisma.TransactionClient,
  resultId: string,
  test: { qcMin: number | null; qcMax: number | null; unit: string },
  value: number,
  qcStatus: 'PASSED' | 'FAILED'
) {
  const openFlag = await tx.qCFlag.findFirst({
    where: { testResultId: resultId, field: 'value', resolved: false },
  });

  if (qcStatus === 'FAILED') {
    const expected = `${test.qcMin ?? '…'}–${test.qcMax ?? '…'} ${test.unit}`;
    const actual = `${value} ${test.unit}`;
    if (openFlag) {
      await tx.qCFlag.update({ where: { id: openFlag.id }, data: { expected, actual } });
    } else {
      await tx.qCFlag.create({
        data: {
          testResultId: resultId,
          field: 'value',
          expected,
          actual,
          description: 'Результат вне QC-диапазона',
        },
      });
    }
  } else if (openFlag) {
    await tx.qCFlag.update({
      where: { id: openFlag.id },
      data: { resolved: true, resolvedAt: new Date(), resolvedBy: 'auto:fixed' },
    });
  }
}