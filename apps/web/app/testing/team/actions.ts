'use server';

import { prisma } from '../../../lib/prisma';
import { revalidatePath } from 'next/cache';

type Phase = 'PRESEASON' | 'CAMP' | 'INSEASON' | 'POSTSEASON' | 'RECOVERY';
const PHASES = new Set<string>(['PRESEASON', 'CAMP', 'INSEASON', 'POSTSEASON', 'RECOVERY']);

export async function saveTeamResults(params: {
  testId: string;
  date: string;
  phase: string;
  entries: { playerId: string; value: number }[];
}) {
  // --- Серверная валидация: не доверяем клиенту ---
  if (!PHASES.has(params.phase)) throw new Error('Некорректная фаза сезона.');
  if (!params.entries.length) throw new Error('Нет ни одного результата для сохранения.');

  const date = new Date(params.date + 'T12:00:00.000Z');
  if (Number.isNaN(date.getTime())) throw new Error('Некорректная дата.');

  const phase = params.phase as Phase;

  // Только активный (не архивированный) тест
  const test = await prisma.test.findFirst({ where: { id: params.testId, deletedAt: null } });
  if (!test) throw new Error('Тест не найден или архивирован.');

  const team = await prisma.team.findFirst();
  const season = await prisma.season.findFirst();
  if (!team || !season) throw new Error('Команда или сезон не найдены.');

  // Игроки: существуют, не удалены, принадлежат команде
  const playerIds = [...new Set(params.entries.map((e) => e.playerId))];
  const players = await prisma.player.findMany({
    where: { id: { in: playerIds }, deletedAt: null, teamId: team.id },
    select: { id: true },
  });
  const validIds = new Set(players.map((p) => p.id));
  for (const id of playerIds) {
    if (!validIds.has(id))
      throw new Error('Один из игроков не найден, удалён или не принадлежит команде.');
  }
  for (const e of params.entries) {
    if (!Number.isFinite(e.value)) throw new Error('Все значения должны быть числами.');
  }

  // --- Атомарная запись: либо все результаты, либо ни одного ---
  const summary = await prisma.$transaction(async (tx) => {
    const out: { playerId: string; sessionId: string; created: boolean }[] = [];

    for (const e of params.entries) {
      let session = await tx.testSession.findFirst({
        where: { playerId: e.playerId, DateTime: date, phase, deletedAt: null },
      });

      let created = false;
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
            playerId: e.playerId,
            teamId: team.id,
            seasonId: season.id,
          },
        });
        created = true;
      }

      let qcStatus: 'PASSED' | 'FAILED' = 'PASSED';
      if (test.qcMin !== null && e.value < test.qcMin) qcStatus = 'FAILED';
      if (test.qcMax !== null && e.value > test.qcMax) qcStatus = 'FAILED';

      const result = await tx.testResult.upsert({
        where: {
          testSessionId_testId: { testSessionId: session.id, testId: test.id },
        },
        update: { value: e.value, qcStatus },
        create: {
          value: e.value,
          qcStatus,
          testId: test.id,
          playerId: e.playerId,
          testSessionId: session.id,
        },
      });

      // Синхронизация QC-флага с реальным состоянием результата
      const openFlag = await tx.qCFlag.findFirst({
        where: { testResultId: result.id, field: 'value', resolved: false },
      });
      if (qcStatus === 'FAILED') {
        const expected = `${test.qcMin ?? '…'}–${test.qcMax ?? '…'} ${test.unit}`;
        const actual = `${e.value} ${test.unit}`;
        if (openFlag) {
          await tx.qCFlag.update({
            where: { id: openFlag.id },
            data: { expected, actual },
          });
        } else {
          await tx.qCFlag.create({
            data: {
              testResultId: result.id,
              field: 'value',
              expected,
              actual,
              description: 'Результат вне QC-диапазона',
            },
          });
        }
      } else if (openFlag) {
        // Значение исправлено — старый открытый флаг закрываем автоматически
        await tx.qCFlag.update({
          where: { id: openFlag.id },
          data: { resolved: true, resolvedAt: new Date(), resolvedBy: 'auto:fixed' },
        });
      }

      out.push({ playerId: e.playerId, sessionId: session.sessionId, created });
    }
    return out;
  });

  revalidatePath('/sessions', 'layout');
  revalidatePath('/players', 'layout');
  revalidatePath('/analytics', 'layout');
  revalidatePath('/compare');
  revalidatePath('/qc');
  revalidatePath('/goals', 'layout');
  revalidatePath('/');
  return summary;
}