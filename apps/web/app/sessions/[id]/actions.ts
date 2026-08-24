'use server';

import { prisma } from '../../../lib/prisma';
import { revalidatePath } from 'next/cache';
import { computeQcStatus, syncQcFlag } from '../../../lib/qc';
import { syncGoalsForResult } from '../../../lib/goals';
import { requireAppContext } from '../../../lib/app-context';

export async function saveResults(
  sessionId: string,
  entries: { testId: string; value: number }[]
) {
  const context = await requireAppContext();
  const session = await prisma.testSession.findFirst({
    where: { id: sessionId, teamId: context.teamId, seasonId: context.seasonId, deletedAt: null },
  });
  if (!session) throw new Error('Сессия не найдена или удалена.');
  if (!entries.length) throw new Error('Нет ни одного результата для сохранения.');

  const testIds = [...new Set(entries.map((e) => e.testId))];
  if (testIds.length !== entries.length)
    throw new Error('В запросе повторяются результаты одного теста.');
  for (const e of entries) {
    if (!Number.isFinite(e.value)) throw new Error('Все значения должны быть числами.');
  }

  const tests = await prisma.test.findMany({ where: { id: { in: testIds } } });
  const byId = new Map(tests.map((t) => [t.id, t]));
  for (const id of testIds) {
    if (!byId.has(id)) throw new Error('Один из тестов не найден.');
  }

  // Новые результаты по архивному тесту добавлять нельзя; исправление истории — можно
  const existing = await prisma.testResult.findMany({
    where: { testSessionId: session.id, testId: { in: testIds } },
    select: { testId: true },
  });
  const existingIds = new Set(existing.map((r) => r.testId));
  for (const id of testIds) {
    const t = byId.get(id)!;
    if (t.deletedAt && !existingIds.has(id)) {
      throw new Error(`Тест «${t.name}» архивирован — новые результаты по нему добавлять нельзя.`);
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const e of entries) {
      const test = byId.get(e.testId)!;
      const qcStatus = computeQcStatus(test, e.value);
      const result = await tx.testResult.upsert({
        where: {
          testSessionId_testId: { testSessionId: session.id, testId: e.testId },
        },
        update: { value: e.value, qcStatus, deletedAt: null },
        create: {
          value: e.value,
          qcStatus,
          testId: e.testId,
          playerId: session.playerId, // игрок — только из сессии, не из клиента
          testSessionId: session.id,
        },
      });
      await syncQcFlag(tx, result.id, test, e.value, qcStatus);
      await syncGoalsForResult(tx, session.playerId, e.testId, context.seasonId);
    }
  });

  revalidatePath('/sessions', 'layout');
  revalidatePath('/players', 'layout');
  revalidatePath('/analytics', 'layout');
  revalidatePath('/compare');
  revalidatePath('/qc');
  revalidatePath('/goals', 'layout');
  revalidatePath('/');
  return { ok: true };
}
