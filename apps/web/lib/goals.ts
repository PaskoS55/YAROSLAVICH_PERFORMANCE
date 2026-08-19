import type { Prisma } from '@prisma/client';

// CONTEXTUAL намеренно не определяется автоматически — как и в процентильной логике
export function goalReached(direction: string, targetValue: number, value: number): boolean {
  if (direction === 'HIGHER_IS_BETTER') return value >= targetValue;
  if (direction === 'LOWER_IS_BETTER') return value <= targetValue;
  return false;
}

// Вызывается внутри транзакции рядом с syncQcFlag:
// цель достигается независимо от источника результата (команда, сессия, CSV)
export async function syncGoalsForResult(
  tx: Prisma.TransactionClient,
  playerId: string,
  testId: string,
  _value: number
) {
  const test = await tx.test.findUnique({ where: { id: testId } });
  if (!test) return;

  const goals = await tx.playerGoal.findMany({
    where: { playerId, testId, deletedAt: null },
  });
  const passedResults = await tx.testResult.findMany({
    where: { playerId, testId, deletedAt: null, qcStatus: 'PASSED' },
    select: { value: true },
  });

  for (const g of goals) {
    const achieved = passedResults.some((result) =>
      goalReached(test.direction, g.targetValue, result.value)
    );
    if (g.achieved !== achieved) {
      await tx.playerGoal.update({
        where: { id: g.id },
        data: { achieved, achievedAt: achieved ? new Date() : null },
      });
    }
  }
}
