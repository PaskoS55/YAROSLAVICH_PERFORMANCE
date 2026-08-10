'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';

export type ImportRow = {
  playerCode: string;
  date: string;
  testCode: string;
  value: number;
};

export async function importRows(rows: ImportRow[]) {
  let ok = 0;
  const errors: string[] = [];

  for (const r of rows) {
    try {
      const player = await prisma.player.findFirst({
        where: { playerId: r.playerCode, deletedAt: null },
      });
      const test = await prisma.test.findFirst({
        where: { code: r.testCode, deletedAt: null },
      });
      if (!player || !test) {
        errors.push(`${r.playerCode}/${r.testCode}: не найден игрок или тест`);
        continue;
      }
      const date = new Date(r.date + 'T12:00:00.000Z');
      if (Number.isNaN(date.getTime())) {
        errors.push(`${r.playerCode}: неверная дата ${r.date}`);
        continue;
      }

      let session = await prisma.testSession.findFirst({
        where: { playerId: player.id, DateTime: date, deletedAt: null },
      });
      if (!session) {
        let n = (await prisma.testSession.count()) + 1;
        let sessionId = `S${String(n).padStart(3, '0')}`;
        while (await prisma.testSession.findUnique({ where: { sessionId } })) {
          n += 1;
          sessionId = `S${String(n).padStart(3, '0')}`;
        }
        const season = await prisma.season.findFirst();
        session = await prisma.testSession.create({
          data: {
            sessionId,
            DateTime: date,
            phase: 'INSEASON',
            playerId: player.id,
            teamId: player.teamId,
            seasonId: season!.id,
          },
        });
      }

      let qcStatus: 'PASSED' | 'FAILED' = 'PASSED';
      if (test.qcMin !== null && r.value < test.qcMin) qcStatus = 'FAILED';
      if (test.qcMax !== null && r.value > test.qcMax) qcStatus = 'FAILED';

      await prisma.testResult.upsert({
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
      ok += 1;
    } catch {
      errors.push(`${r.playerCode}/${r.testCode}: ошибка записи`);
    }
  }

  revalidatePath('/sessions', 'layout');
  revalidatePath('/players', 'layout');
  revalidatePath('/', 'layout');
  return { ok, errors };
}