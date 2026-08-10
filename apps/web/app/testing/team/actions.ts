'use server';

import { prisma } from '../../../lib/prisma';
import { revalidatePath } from 'next/cache';

export async function saveTeamResults(params: {
  testId: string;
  date: string;
  phase: string;
  entries: { playerId: string; value: number }[];
}) {
  const test = await prisma.test.findUnique({ where: { id: params.testId } });
  if (!test) throw new Error('Test not found');

  const team = await prisma.team.findFirst();
  const season = await prisma.season.findFirst();
  if (!team || !season) throw new Error('Team or season not found');

  const date = new Date(params.date + 'T12:00:00.000Z');

  const summary: { playerId: string; sessionId: string; created: boolean }[] = [];

  for (const e of params.entries) {
    let session = await prisma.testSession.findFirst({
      where: {
        playerId: e.playerId,
        DateTime: date,
        phase: params.phase as 'CAMP',
        deletedAt: null,
      },
    });

    let created = false;
    if (!session) {
      let n = (await prisma.testSession.count()) + 1;
      let sessionId = `S${String(n).padStart(3, '0')}`;
      while (await prisma.testSession.findUnique({ where: { sessionId } })) {
        n += 1;
        sessionId = `S${String(n).padStart(3, '0')}`;
      }
      session = await prisma.testSession.create({
        data: {
          sessionId,
          DateTime: date,
          phase: params.phase as 'CAMP',
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

    await prisma.testResult.upsert({
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

    summary.push({ playerId: e.playerId, sessionId: session.sessionId, created });
  }

  revalidatePath('/sessions', 'layout');
  revalidatePath('/players', 'layout');
  return summary;
}
