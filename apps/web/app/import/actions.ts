'use server';
import { assertBodyMetricWritable, lockMeasurementSession, projectBodyMetric } from '../../lib/body-metrics';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';
import { computeQcStatus, syncQcFlag } from '../../lib/qc';
import { syncGoalsForResult } from '../../lib/goals';
import { requireAppContext } from '../../lib/app-context';
import { measurementDay } from '../../lib/measurement-date';

export type ImportRow = {
  playerCode: string;
  date: string;
  testCode: string;
  value: number;
  phase?: string;
};

type Phase = 'PRESEASON' | 'CAMP' | 'INSEASON' | 'POSTSEASON' | 'RECOVERY';
const PHASES = new Set<string>(['PRESEASON', 'CAMP', 'INSEASON', 'POSTSEASON', 'RECOVERY']);

export async function importRows(rows: ImportRow[]) {
  const context = await requireAppContext();
  let ok = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 1;
    try {
      if (!Number.isFinite(r.value)) {
        errors.push(`Строка ${line}: значение не является числом.`);
        continue;
      }

      const rawPhase = (r.phase ?? '').trim().toUpperCase();
      if (rawPhase && !PHASES.has(rawPhase)) {
        errors.push(`Строка ${line}: неверная фаза «${r.phase}».`);
        continue;
      }
      const phase = (rawPhase || 'INSEASON') as Phase;

      const player = await prisma.player.findFirst({
        where: { teamId: context.teamId, playerId: r.playerCode, deletedAt: null },
      });
      const test = await prisma.test.findFirst({
        where: { code: r.testCode, deletedAt: null },
      });
      if (!player || !test) {
        errors.push(`Строка ${line}: не найден игрок или тест (${r.playerCode} / ${r.testCode}).`);
        continue;
      }

      let date: Date;
      let dayEnd: Date;
      try {
        ({ start: date, end: dayEnd } = measurementDay(r.date));
      } catch {
        errors.push(`Строка ${line}: неверная дата «${r.date}».`);
        continue;
      }

      // Каждая строка атомарна: сессия + результат + QC-флаг либо целиком, либо нет
      await prisma.$transaction(async (tx) => {
        let session = await tx.testSession.findFirst({
          where: { playerId: player.id, teamId: context.teamId, seasonId: context.seasonId, DateTime: { gte: date, lt: dayEnd }, phase },
          orderBy: [{ DateTime: 'desc' }, { id: 'desc' }],
        });
        if (!session) {
          const sessionId = `S-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
          session = await tx.testSession.create({
            data: {
              sessionId,
              DateTime: date,
              phase,
              playerId: player.id,
              teamId: context.teamId,
              seasonId: context.seasonId,
            },
          });
        } else if (session.deletedAt) {
          session = await tx.testSession.update({
            where: { id: session.id },
            data: { deletedAt: null, teamId: context.teamId, seasonId: context.seasonId },
          });
        }

        await lockMeasurementSession(tx, session.id);
        await assertBodyMetricWritable(tx, session.id, player.id, test);
        const qcStatus = computeQcStatus(test, r.value);
        const result = await tx.testResult.upsert({
          where: {
            testSessionId_testId: { testSessionId: session.id, testId: test.id },
          },
          update: { value: r.value, qcStatus, deletedAt: null, playerId: player.id },
          create: {
            value: r.value,
            qcStatus,
            testId: test.id,
            playerId: player.id,
            testSessionId: session.id,
          },
        });
        await syncQcFlag(tx, result.id, test, r.value, qcStatus);
        await projectBodyMetric(tx, session.id, player.id, test.code, r.value);
        await syncGoalsForResult(tx, player.id, test.id, context.teamId);
      });
      ok += 1;
    } catch {
      errors.push(`Строка ${line}: ошибка записи.`);
    }
  }

  revalidatePath('/sessions', 'layout');
  revalidatePath('/players', 'layout');
  revalidatePath('/analytics', 'layout');
  revalidatePath('/compare');
  revalidatePath('/qc');
  revalidatePath('/body');
  revalidatePath('/goals', 'layout');
  revalidatePath('/', 'layout');
  return { ok, errors };
}
