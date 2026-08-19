'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';
import { syncGoalsForResult } from '../../lib/goals';

export async function resolveFlag(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const reason = String(formData.get('reason') ?? 'manual').trim() || 'manual';

  const flag = await prisma.qCFlag.findUnique({
    where: { id },
    include: { testResult: true },
  });
  if (!flag) {
    console.error('resolveFlag: флаг не найден.');
    return;
  }
  if (flag.resolved) {
    console.error('resolveFlag: флаг уже решён.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.qCFlag.update({
      where: { id },
      data: { resolved: true, resolvedAt: new Date(), resolvedBy: reason },
    });
    await tx.testResult.update({
      where: { id: flag.testResultId },
      data: { qcStatus: 'PASSED' },
    });

    if (!flag.testResult.deletedAt) {
      await syncGoalsForResult(
        tx,
        flag.testResult.playerId,
        flag.testResult.testId,
        flag.testResult.value
      );
    }
  });
  revalidatePath('/qc');
  revalidatePath('/goals', 'layout');
  revalidatePath('/analytics', 'layout');
  revalidatePath('/compare');
  revalidatePath('/players', 'layout');
}
