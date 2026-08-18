import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { revalidatePath } from 'next/cache';
import type {
  Organization,
  Team,
  Season,
  TestCategory,
  Player,
  Test,
  Norm,
  TestSession,
  TestResult,
  BodyComposition,
  PlayerGoal,
  Equipment,
  QCFlag,
  ImportJob,
  AuditLog,
} from '@prisma/client';

export async function POST(req: Request) {
  const confirm = req.headers.get('X-Restore-Confirm');
  if (confirm !== 'ВОССТАНОВИТЬ') {
    return NextResponse.json(
      { error: 'Восстановление не подтверждено. Требуется X-Restore-Confirm.' },
      { status: 400 }
    );
  }

  let backup: Record<string, unknown>;
  try {
    backup = await req.json();
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON-файл.' }, { status: 400 });
  }

  if (
    (backup as { brand?: string }).brand !== 'PASKO PERFORMANCE' ||
    !Array.isArray((backup as { tests?: unknown }).tests)
  ) {
    return NextResponse.json(
      { error: 'Файл не похож на резервную копию PASKO PERFORMANCE.' },
      { status: 400 }
    );
  }

  const arr = <T>(k: string): T[] => (Array.isArray(backup[k]) ? (backup[k] as T[]) : []);

  const organizations = arr<Organization>('organizations');
  const teams = arr<Team>('teams');
  const seasons = arr<Season>('seasons');
  const testCategories = arr<TestCategory>('testCategories');
  const players = arr<Player>('players');
  const tests = arr<Test>('tests');
  const norms = arr<Norm>('norms');
  const testSessions = arr<TestSession>('testSessions');
  const testResults = arr<TestResult>('testResults');
  const bodyCompositions = arr<BodyComposition>('bodyCompositions');
  const playerGoals = arr<PlayerGoal>('playerGoals');
  const equipment = arr<Equipment>('equipment');
  const qcFlags = arr<QCFlag>('qcFlags');
  const importJobs = arr<ImportJob>('importJobs');
  const auditLogs = arr<AuditLog>('auditLogs');
  const teamSeasonLinks = arr<{ teamId: string; seasonId: string }>('teamSeasonLinks');

  try {
    await prisma.$transaction(async (tx) => {
      await tx.qCFlag.deleteMany();
      await tx.testResult.deleteMany();
      await tx.bodyComposition.deleteMany();
      await tx.playerGoal.deleteMany();
      await tx.testSession.deleteMany();
      await tx.norm.deleteMany();
      await tx.test.deleteMany();
      await tx.testCategory.deleteMany();
      await tx.player.deleteMany();
      await tx.season.deleteMany();
      await tx.team.deleteMany();
      await tx.organization.deleteMany();
      await tx.equipment.deleteMany();
      await tx.importJob.deleteMany();
      await tx.auditLog.deleteMany();

      if (organizations.length) await tx.organization.createMany({ data: organizations });
      if (teams.length) await tx.team.createMany({ data: teams });
      if (seasons.length) await tx.season.createMany({ data: seasons });
      if (testCategories.length) await tx.testCategory.createMany({ data: testCategories });
      if (equipment.length) await tx.equipment.createMany({ data: equipment });
      if (players.length) await tx.player.createMany({ data: players });
      if (tests.length) await tx.test.createMany({ data: tests });
      if (norms.length) await tx.norm.createMany({ data: norms });
      if (testSessions.length) await tx.testSession.createMany({ data: testSessions });
      if (testResults.length) await tx.testResult.createMany({ data: testResults });
      if (bodyCompositions.length)
        await tx.bodyComposition.createMany({ data: bodyCompositions });
      if (playerGoals.length) await tx.playerGoal.createMany({ data: playerGoals });
      if (qcFlags.length) await tx.qCFlag.createMany({ data: qcFlags });
      
      // importJobs и auditLogs могут содержать JSON null — используем create по одному
      for (const job of importJobs) {
        await tx.importJob.create({
          data: {
            ...job,
            errors: job.errors ?? undefined,
          } as any,
        });
      }
      for (const log of auditLogs) {
        await tx.auditLog.create({ data: log as any });
      }

      for (const link of teamSeasonLinks) {
        if (link.teamId && link.seasonId) {
          await tx.team.update({
            where: { id: link.teamId },
            data: { seasons: { connect: { id: link.seasonId } } },
          });
        }
      }
    });
  } catch {
    return NextResponse.json(
      {
        error:
          'Резервная копия несовместима с текущей версией схемы или повреждена. Восстановление отменено, данные не изменены.',
      },
      { status: 400 }
    );
  }

  revalidatePath('/', 'layout');
  revalidatePath('/players', 'layout');
  revalidatePath('/sessions', 'layout');
  revalidatePath('/analytics', 'layout');
  revalidatePath('/compare');
  revalidatePath('/qc');
  revalidatePath('/norms');
  revalidatePath('/tests', 'layout');
  revalidatePath('/protocols');
  revalidatePath('/goals', 'layout');
  revalidatePath('/settings');

  return NextResponse.json({
    ok: true,
    restored: {
      testCategories: testCategories.length,
      tests: tests.length,
      players: players.length,
      testSessions: testSessions.length,
      testResults: testResults.length,
      teamSeasonLinks: teamSeasonLinks.length,
    },
  });
}