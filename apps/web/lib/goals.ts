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
  value: number
) {
  const test = await tx.test.findUnique({ where: { id: testId } });
  if (!test) return;

  const goals = await tx.playerGoal.findMany({
    where: { playerId, testId, achieved: false, deletedAt: null },
  });

  for (const g of goals) {
    if (goalReached(test.direction, g.targetValue, value)) {
      await tx.playerGoal.update({
        where: { id: g.id },
        data: { achieved: true, achievedAt: new Date() },
      });
    }
  }
}