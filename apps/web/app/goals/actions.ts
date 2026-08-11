'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';

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
  if (!playerId || !testId || Number.isNaN(targetValue) || !targetDateStr) return;

  await prisma.playerGoal.create({
    data: {
      playerId,
      testId,
      targetValue,
      targetDate: new Date(targetDateStr),
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

  for (const g of goals) {
    const lastResult = await prisma.testResult.findFirst({
      where: { playerId: g.playerId, testId: g.testId, deletedAt: null },
      orderBy: { testSession: { DateTime: 'desc' } },
    });
    if (!lastResult) continue;

    const better =
      g.test.direction === 'HIGHER_IS_BETTER'
        ? lastResult.value >= g.targetValue
        : g.test.direction === 'LOWER_IS_BETTER'
          ? lastResult.value <= g.targetValue
          : false;

    if (better) {
      await prisma.playerGoal.update({
        where: { id: g.id },
        data: { achieved: true, achievedAt: new Date() },
      });
    }
  }

  revalidatePath('/goals');
  revalidatePath('/players', 'layout');
}