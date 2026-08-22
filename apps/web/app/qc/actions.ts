'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';
import { syncGoalsForResult } from '../../lib/goals';
import { requireAppContext } from '../../lib/app-context';

export async function resolveFlag(formData: FormData): Promise<void> {
  const context = await requireAppContext();
  const id = String(formData.get('id') ?? '');
  const reason = String(formData.get('reason') ?? 'manual').trim() || 'manual';

  const flag = await prisma.qCFlag.findUnique({
    where: { id },
    include: { testResult: { include: { testSession: { select: { teamId: true, seasonId: true, deletedAt: true } }, player: { select: { teamId: true } } } } },
  });
  if (!flag || flag.testResult.player.teamId !== context.teamId || flag.testResult.testSession.teamId !== context.teamId || flag.testResult.testSession.seasonId !== context.seasonId || flag.testResult.testSession.deletedAt) {
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
        context.seasonId
      );
    }
  });
  revalidatePath('/qc');
  revalidatePath('/goals', 'layout');
  revalidatePath('/analytics', 'layout');
  revalidatePath('/compare');
  revalidatePath('/players', 'layout');
}
