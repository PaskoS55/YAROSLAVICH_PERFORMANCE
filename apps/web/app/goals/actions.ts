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