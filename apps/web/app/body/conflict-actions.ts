'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { readSession } from '../../lib/session';
import { prisma } from '../../lib/prisma';
import { requireAppContext } from '../../lib/app-context';
import { BODY_METRICS, bodyMetricConflict, isBodyMetric, lockMeasurementSession } from '../../lib/body-metrics';
import { computeQcStatus, syncQcFlag } from '../../lib/qc';

export async function resolveBodyConflict(formData: FormData): Promise<void> {
  const context = await requireAppContext();
  const token = (await cookies()).get('yp_auth')?.value;
  const actor = token ? await readSession(token) : null;
  if (!actor) redirect('/login');
  const id = String(formData.get('snapshot') ?? '');
  const code = String(formData.get('metric') ?? '');
  const choice = String(formData.get('choice') ?? '');
  if (!isBodyMetric(code) || !['test', 'body'].includes(choice)) redirect('/body?error=conflict');
  try {
    await prisma.$transaction(async tx => {
      const scope = { id, deletedAt: null, player: { teamId: context.teamId, deletedAt: null },
        testSession: { teamId: context.teamId, seasonId: context.seasonId, deletedAt: null } };
      const initial = await tx.bodyComposition.findFirst({ where: scope });
      if (!initial) throw new Error('INVALID_SCOPE');
      await lockMeasurementSession(tx, initial.testSessionId);
      const snapshot = await tx.bodyComposition.findFirstOrThrow({ where: scope, include: { testSession: true } });
      if (snapshot.testSession.playerId !== snapshot.playerId) throw new Error('INVALID_LINK');
      const test = await tx.test.findUniqueOrThrow({ where: { code } });
      if (test.unit !== BODY_METRICS[code].unit) throw new Error('INVALID_UNIT');
      const existing = await tx.testResult.findUnique({ where: { testSessionId_testId: { testSessionId: snapshot.testSessionId, testId: test.id } } });
      if (!bodyMetricConflict(snapshot, code, existing)) return; // safe replay
      if (snapshot.updatedAt.toISOString() !== String(formData.get('snapshotVersion')) || (existing?.updatedAt.toISOString() ?? '') !== String(formData.get('resultVersion'))) throw new Error('STALE_CONFLICT');
      if (existing && existing.playerId !== snapshot.playerId) throw new Error('INVALID_LINK');
      const field = BODY_METRICS[code].field;
      const value = choice === 'test' ? existing && !existing.deletedAt ? existing.value : null : snapshot[field];
      if (value === null || !Number.isFinite(value)) throw new Error('INVALID_VALUE');
      if (choice === 'body') {
        const qcStatus = computeQcStatus(test, value);
        const result = await tx.testResult.upsert({
          where: { testSessionId_testId: { testSessionId: snapshot.testSessionId, testId: test.id } },
          create: { testSessionId: snapshot.testSessionId, playerId: snapshot.playerId, testId: test.id, value, qcStatus },
          update: { value, qcStatus, deletedAt: null },
        });
        await syncQcFlag(tx, result.id, test, value, qcStatus);
      }
      // Preserve other legacy snapshots. Each conflicting record is an explicit
      // choice; never overwrite an unrelated/multiple snapshot by nearest date.
      await tx.bodyComposition.update({ where: { id: snapshot.id }, data: { [field]: value } });
      await tx.auditLog.create({ data: {
        action: 'BODY_METRIC_CONFLICT_RESOLVED', entity: 'BodyComposition', entityId: snapshot.id, userId: actor.userId,
        oldValues: { metric: code, bodyValue: snapshot[field], testValue: existing?.value ?? null, testDeleted: !!existing?.deletedAt },
        newValues: { metric: code, value, choice, testSessionId: snapshot.testSessionId, playerId: snapshot.playerId },
      } });
    });
  } catch {
    redirect('/body?error=resolution');
  }
  revalidatePath('/', 'layout');
  redirect('/body?saved=1');
}
