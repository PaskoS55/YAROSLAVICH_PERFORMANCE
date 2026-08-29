'use server';

import { prisma } from '../../lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { measurementDay } from '../../lib/measurement-date';
import { BODY_METRICS, assertBodyMetricWritable, lockMeasurementSession, projectBodyMetric, type BodyMetricCode } from '../../lib/body-metrics';
import { computeQcStatus, syncQcFlag } from '../../lib/qc';
import { syncGoalsForResult } from '../../lib/goals';
import { requireAppContext } from '../../lib/app-context';

type Phase = 'PRESEASON' | 'CAMP' | 'INSEASON' | 'POSTSEASON' | 'RECOVERY';
const PHASES = new Set<string>(['PRESEASON', 'CAMP', 'INSEASON', 'POSTSEASON', 'RECOVERY']);

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim().replace(',', '.');
  return s === '' ? null : Number(s);
};

export async function createBodyComposition(formData: FormData): Promise<void> {
  const context = await requireAppContext();
  const playerId = String(formData.get('playerId') ?? '');
  const dateStr = String(formData.get('date') ?? '');
  const mass = num(formData.get('mass'));
  const fat = num(formData.get('fat'));
  const ffm = num(formData.get('ffm'));
  const phase = num(formData.get('phase'));
  const phaseStr = String(formData.get('sessionPhase') ?? 'INSEASON').toUpperCase();

  function invalid(): never { return redirect('/body?error=invalid'); }

  // Валидация
  if (!playerId || !dateStr) {
    invalid();
  }
  if (mass === null || fat === null || ffm === null) {
    invalid();
  }
  if (!Number.isFinite(mass) || !Number.isFinite(fat) || !Number.isFinite(ffm)) {
    invalid();
  }
  if (mass <= 0 || mass > 300) {
    invalid();
  }
  if (fat < 0 || fat > 60) {
    invalid();
  }
  if (ffm <= 0 || ffm > mass) {
    invalid();
  }
  if (phase !== null && (!Number.isFinite(phase) || phase < 0 || phase > 15)) {
    invalid();
  }
  if (!PHASES.has(phaseStr)) {
    invalid();
  }

  let date: Date;
  let dayEnd: Date;
  try { ({ start: date, end: dayEnd } = measurementDay(dateStr)); }
  catch { return invalid(); }

  const player = await prisma.player.findFirst({
    where: { id: playerId, teamId: context.teamId, deletedAt: null },
  });
  if (!player) {
    invalid();
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM players WHERE id = ${playerId} FOR UPDATE`;
      const candidates = await tx.testSession.findMany({
        where: {
          playerId,
          DateTime: { gte: date, lt: dayEnd },
          phase: phaseStr as Phase,
          teamId: context.teamId,
          seasonId: context.seasonId,
        },
        take: 2,
      });

      if (candidates.length > 1) throw new Error('BODY_AMBIGUOUS_SESSION');
      let session = candidates[0];
      if (!session) {
        const sessionId = `S-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        session = await tx.testSession.create({
          data: {
            sessionId,
            DateTime: date,
            phase: phaseStr as Phase,
            playerId,
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
      const tests = await tx.test.findMany({ where: { code: { in: Object.keys(BODY_METRICS) }, deletedAt: null } });
      if (tests.length !== 3) throw new Error('BODY_METRIC_DEFINITION_MISSING');
      for (const test of tests) await assertBodyMetricWritable(tx, session.id, playerId, test);
      const values: Record<BodyMetricCode, number> = { BC_MASS: mass, BC_FAT: fat, BC_FFM: ffm };
      for (const test of tests) {
        const value = values[test.code as BodyMetricCode];
        const qcStatus = computeQcStatus(test, value);
        const result = await tx.testResult.upsert({
          where: { testSessionId_testId: { testSessionId: session.id, testId: test.id } },
          update: { value, qcStatus, playerId, deletedAt: null },
          create: { value, qcStatus, playerId, testId: test.id, testSessionId: session.id },
        });
        await syncQcFlag(tx, result.id, test, value, qcStatus);
        await projectBodyMetric(tx, session.id, playerId, test.code, value);
        await syncGoalsForResult(tx, playerId, test.id, context.teamId);
      }
      await tx.bodyComposition.updateMany({
        where: { testSessionId: session.id, playerId, deletedAt: null }, data: { phase_angle: phase },
      });
    });

    revalidatePath('/body');
    revalidatePath('/players', 'layout');
    revalidatePath('/analytics', 'layout');
    revalidatePath('/compare');
    revalidatePath('/reports');
    revalidatePath('/goals');
    revalidatePath('/sessions');
    revalidatePath('/qc');
    revalidatePath('/');
  } catch (error) {
    const code = error instanceof Error && error.message.startsWith('BODY_CONFLICT') ? 'conflict'
      : error instanceof Error && error.message === 'BODY_AMBIGUOUS_SESSION' ? 'ambiguous' : 'save';
    redirect(`/body?error=${code}`);
  }
  redirect('/body?saved=1');
}
