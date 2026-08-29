'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';
import { syncGoalsForResult } from '../../lib/goals';
import { requireAppContext } from '../../lib/app-context';
import { measurementDay } from '../../lib/measurement-date';
import { redirect } from 'next/navigation';

export async function markGoalAchieved(formData: FormData) {
  const context = await requireAppContext();
  const id = String(formData.get('id'));
  const goal = await prisma.playerGoal.findFirst({ where: { id, achieved: false, deletedAt: null, player: { teamId: context.teamId, deletedAt: null } }, select: { id: true } });
  if (!goal) return;
  await prisma.playerGoal.update({
    where: { id: goal.id },
    data: { achieved: true, achievedAt: new Date() },
  });
  revalidatePath('/goals');
  revalidatePath('/players', 'layout');
}

export async function createGoal(formData: FormData) {
  const context = await requireAppContext();
  const playerId = String(formData.get('playerId') ?? '');
  const testId = String(formData.get('testId') ?? '');
  const targetValueText = String(formData.get('targetValue') ?? '').trim();
  const targetValue = Number(targetValueText.replace(',', '.'));
  const targetDateStr = String(formData.get('targetDate') ?? '');
  if (!playerId || !testId || !targetValueText || !Number.isFinite(targetValue) || !targetDateStr) redirect('/goals?error=invalid');

  try { measurementDay(targetDateStr); } catch { redirect('/goals?error=invalid'); }
  const targetDate = new Date(targetDateStr);

  const [player, test] = await Promise.all([
    prisma.player.findFirst({ where: { id: playerId, teamId: context.teamId, deletedAt: null } }),
    prisma.test.findFirst({ where: { id: testId, deletedAt: null } }),
  ]);
  if (!player || !test) return;

  await prisma.$transaction(async tx => {
    // Serialize same-player retries: no schema/season ownership inference needed.
    await tx.$queryRaw`SELECT id FROM players WHERE id = ${playerId} FOR UPDATE`;
    const existing = await tx.playerGoal.findFirst({where: {playerId, testId, targetValue, targetDate, deletedAt: null}});
    if (!existing) await tx.playerGoal.create({data: {playerId, testId, targetValue, targetDate, achieved: false}});
    await syncGoalsForResult(tx, playerId, testId, context.teamId);
  });

  revalidatePath('/goals');
  revalidatePath('/players', 'layout');
}

export async function syncGoals() {
  const context = await requireAppContext();
  // Achievement means at least one eligible historical measurement reached the
  // target, not necessarily the most recent measurement. Same rule as QC/import.
  await prisma.$transaction(async tx => {
    const goals = await tx.playerGoal.findMany({
      where: { deletedAt: null, player: { teamId: context.teamId, deletedAt: null } },
      select: { playerId: true, testId: true },
    });
    const pairs = new Map(goals.map(goal => [`${goal.playerId}|${goal.testId}`, goal]));
    for (const { playerId, testId } of pairs.values()) {
      await syncGoalsForResult(tx, playerId, testId, context.teamId);
    }
  });

  revalidatePath('/goals');
  revalidatePath('/players', 'layout');
}
