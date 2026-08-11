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