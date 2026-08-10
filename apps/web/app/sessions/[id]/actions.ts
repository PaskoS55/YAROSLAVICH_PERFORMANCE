'use server';

import { prisma } from '../../../lib/prisma';
import { revalidatePath } from 'next/cache';

export async function saveResults(
  sessionId: string,
  playerId: string,
  entries: { testId: string; value: number }[]
) {
  for (const e of entries) {
    const test = await prisma.test.findUnique({ where: { id: e.testId } });
    if (!test) continue;

    let qcStatus: 'PASSED' | 'FAILED' = 'PASSED';
    if (test.qcMin !== null && e.value < test.qcMin) qcStatus = 'FAILED';
    if (test.qcMax !== null && e.value > test.qcMax) qcStatus = 'FAILED';

    await prisma.testResult.upsert({
      where: {
        testSessionId_testId: { testSessionId: sessionId, testId: e.testId },
      },
      update: { value: e.value, qcStatus },
      create: {
        value: e.value,
        qcStatus,
        testId: e.testId,
        playerId,
        testSessionId: sessionId,
      },
    });
  }

  revalidatePath('/sessions', 'layout');
  return { ok: true };
}