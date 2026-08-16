import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { revalidatePath } from 'next/cache';

export async function POST(req: Request) {
  // Серверная проверка подтверждения — нельзя обойти прямым POST
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

  const arr = <T>(k: string): T[] =>
    Array.isArray(backup[k]) ? (backup[k] as T[]) : [];

  const organizations = arr<Record<string, unknown>>('organizations');
  const teams = arr<Record<string, unknown>>('teams');
  const seasons = arr<Record<string, unknown>>('seasons');
  const testCategories = arr<Record<string, unknown>>('testCategories');
  const players = arr<Record<string, unknown>>('players');
  const tests = arr<Record<string, unknown>>('tests');
  const norms = arr<Record<string, unknown>>('norms');
  const testSessions = arr<Record<string, unknown>>('testSessions');
  const testResults = arr<Record<string, unknown>>('testResults');
  const bodyCompositions = arr<Record<string, unknown>>('bodyCompositions');
  const playerGoals = arr<Record<string, unknown>>('playerGoals');
  const equipment = arr<Record<string, unknown>>('equipment');
  const qcFlags = arr<Record<string, unknown>>('qcFlags');
  const importJobs = arr<Record<string, unknown>>('importJobs');
  const auditLogs = arr<Record<string, unknown>>('auditLogs');
  const teamSeasonLinks = arr<{ teamId: string; seasonId: string }>('teamSeasonLinks');

  try {
    await prisma.$transaction(async (tx) => {
      // Удаляем детей → родителей
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

      // Вставляем родителей → детей, сохраняя исходные id
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
      if (importJobs.length) await tx.importJob.createMany({ data: importJobs });
      if (auditLogs.length) await tx.auditLog.createMany({ data: auditLogs });

      // Восстанавливаем implicit many-to-many Team ↔ Season
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