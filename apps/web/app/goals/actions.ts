'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';
import { goalReached } from '../../lib/goals';

export async function markGoalAchieved(formData: FormData) {
  const id = String(formData.get('id'));
  await prisma.playerGoal.update({
    where: { id },
    data: { achieved: true, achievedAt: new Date() },
  });
  revalidatePath('/goals');
  revalidatePath('/players', 'layout');
}

export async function createGoal(formData: FormData) {
  const playerId = String(formData.get('playerId') ?? '');
  const testId = String(formData.get('testId') ?? '');
  const targetValue = Number(String(formData.get('targetValue') ?? '').replace(',', '.'));
  const targetDateStr = String(formData.get('targetDate') ?? '');
  if (!playerId || !testId || !Number.isFinite(targetValue) || !targetDateStr) return;

  const targetDate = new Date(targetDateStr);
  if (Number.isNaN(targetDate.getTime())) return;

  const [player, test] = await Promise.all([
    prisma.player.findFirst({ where: { id: playerId, deletedAt: null } }),
    prisma.test.findFirst({ where: { id: testId, deletedAt: null } }),
  ]);
  if (!player || !test) return;

  await prisma.playerGoal.create({
    data: {
      playerId,
      testId,
      targetValue,
      targetDate,
      achieved: false,
    },
  });

  revalidatePath('/goals');
  revalidatePath('/players', 'layout');
}

export async function syncGoals() {
  const goals = await prisma.playerGoal.findMany({
    where: { achieved: false, deletedAt: null },
    include: { test: true },
  });
  if (goals.length === 0) {
    revalidatePath('/goals');
    return;
  }

  // Один запрос на все пары (playerId, testId) вместо N+1
  const playerIds = [...new Set(goals.map((g) => g.playerId))];
  const testIds = [...new Set(goals.map((g) => g.testId))];
  const results = await prisma.testResult.findMany({
    where: {
      playerId: { in: playerIds },
      testId: { in: testIds },
      deletedAt: null,
    },
    orderBy: { testSession: { DateTime: 'desc' } },
  });

  const latestByPair = new Map<string, number>();
  for (const r of results) {
    const key = `${r.playerId}|${r.testId}`;
    if (!latestByPair.has(key)) latestByPair.set(key, r.value);
  }

  for (const g of goals) {
    const v = latestByPair.get(`${g.playerId}|${g.testId}`);
    if (v === undefined) continue;
    if (goalReached(g.test.direction, g.targetValue, v)) {
      await prisma.playerGoal.update({
        where: { id: g.id },
        data: { achieved: true, achievedAt: new Date() },
      });
    }
  }

  revalidatePath('/goals');
  revalidatePath('/players', 'layout');
}