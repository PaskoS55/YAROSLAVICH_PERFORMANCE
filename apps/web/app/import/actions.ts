'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';
import { computeQcStatus, syncQcFlag } from '../../lib/qc';

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
  let ok = 0;
  const errors: string[] = [];

  const season = await prisma.season.findFirst();
  if (!season) {
    return { ok: 0, errors: ['Не настроен сезон — импорт невозможен. Создайте сезон в настройках.'] };
  }

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
        where: { playerId: r.playerCode, deletedAt: null },
      });
      const test = await prisma.test.findFirst({
        where: { code: r.testCode, deletedAt: null },
      });
      if (!player || !test) {
        errors.push(`Строка ${line}: не найден игрок или тест (${r.playerCode} / ${r.testCode}).`);
        continue;
      }

      const date = new Date(r.date + 'T12:00:00.000Z');
      if (Number.isNaN(date.getTime())) {
        errors.push(`Строка ${line}: неверная дата «${r.date}».`);
        continue;
      }

      // Каждая строка атомарна: сессия + результат + QC-флаг либо целиком, либо нет
      await prisma.$transaction(async (tx) => {
        let session = await tx.testSession.findFirst({
          where: { playerId: player.id, DateTime: date, phase, deletedAt: null },
        });
        if (!session) {
          let n = (await tx.testSession.count()) + 1;
          let sessionId = `S${String(n).padStart(3, '0')}`;
          while (await tx.testSession.findUnique({ where: { sessionId } })) {
            n += 1;
            sessionId = `S${String(n).padStart(3, '0')}`;
          }
          session = await tx.testSession.create({
            data: {
              sessionId,
              DateTime: date,
              phase,
              playerId: player.id,
              teamId: player.teamId,
              seasonId: season.id,
            },
          });
        }

        const qcStatus = computeQcStatus(test, r.value);
        const result = await tx.testResult.upsert({
          where: {
            testSessionId_testId: { testSessionId: session.id, testId: test.id },
          },
          update: { value: r.value, qcStatus },
          create: {
            value: r.value,
            qcStatus,
            testId: test.id,
            playerId: player.id,
            testSessionId: session.id,
          },
        });
        await syncQcFlag(tx, result.id, test, r.value, qcStatus);
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
  revalidatePath('/goals', 'layout');
  revalidatePath('/', 'layout');
  return { ok, errors };
}