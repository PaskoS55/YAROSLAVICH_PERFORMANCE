import type { Prisma } from '@prisma/client';
import { compareMeasurementSessions } from './measurements';

// CONTEXTUAL намеренно не определяется автоматически — как и в процентильной логике
export function goalReached(direction: string, targetValue: number, value: number): boolean {
  if (!Number.isFinite(targetValue) || !Number.isFinite(value)) return false;
  if (direction === 'HIGHER_IS_BETTER') return value >= targetValue;
  if (direction === 'LOWER_IS_BETTER') return value <= targetValue;
  return false;
}

// Player goals are cross-season. Both display and recalculation use this history;
// the owning team is supplied by the server AppContext, never by a browser field.
export async function goalMeasurements(
  tx: Prisma.TransactionClient, playerIds: string[], testIds: string[], teamId: string, now: Date
) {
  const results = await tx.testResult.findMany({
    where: {
      playerId: { in: playerIds }, testId: { in: testIds },
      player: { teamId, deletedAt: null }, deletedAt: null, qcStatus: 'PASSED',
      testSession: { teamId, playerId: { in: playerIds }, deletedAt: null, DateTime: { lte: now } },
    },
    select: { playerId: true, testId: true, value: true,
      testSession: { select: { id: true, playerId: true, DateTime: true, createdAt: true } } },
  });
  // A legacy inconsistent FK must never borrow another player's measurement.
  return results.filter(result => result.playerId === result.testSession.playerId && Number.isFinite(result.value))
    .sort((a, b) => compareMeasurementSessions(a.testSession, b.testSession));
}

// Вызывается внутри транзакции рядом с syncQcFlag:
// цель достигается независимо от источника результата (команда, сессия, CSV)
export async function syncGoalsForResult(
  tx: Prisma.TransactionClient,
  playerId: string,
  testId: string,
  teamId: string
) {
  const now = new Date();
  const test = await tx.test.findUnique({ where: { id: testId } });
  if (!test || test.direction === 'CONTEXTUAL') return;

  const goals = await tx.playerGoal.findMany({
    where: { playerId, testId, deletedAt: null, player: { teamId, deletedAt: null } },
  });
  const passedResults = (await goalMeasurements(tx, [playerId], [testId], teamId, now)).reverse();

  for (const g of goals) {
    const first = passedResults.find((result) =>
      goalReached(test.direction, g.targetValue, result.value)
    );
    const achievedAt = first?.testSession.DateTime ?? null;
    const achieved = achievedAt !== null;
    if (g.achieved !== achieved || (g.achievedAt?.getTime() ?? null) !== (achievedAt?.getTime() ?? null)) {
      await tx.playerGoal.update({
        where: { id: g.id },
        data: { achieved, achievedAt },
      });
    }
  }
}
