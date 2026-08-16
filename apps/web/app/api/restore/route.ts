import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { revalidatePath } from 'next/cache';

export async function POST(req: Request) {
  let backup: Record<string, unknown> & { brand?: string; tests?: unknown[] };
  try {
    backup = await req.json();
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON-файл.' }, { status: 400 });
  }

  if (backup?.brand !== 'PASKO PERFORMANCE' || !Array.isArray(backup?.tests)) {
    return NextResponse.json(
      { error: 'Файл не похож на резервную копию PASKO PERFORMANCE.' },
      { status: 400 }
    );
  }

  const arr = (k: string) => (Array.isArray(backup[k]) ? (backup[k] as object[]) : []);

  const organizations = arr('organizations');
  const teams = arr('teams');
  const seasons = arr('seasons');
  const testCategories = arr('testCategories');
  const players = arr('players');
  const tests = arr('tests');
  const norms = arr('norms');
  const testSessions = arr('testSessions');
  const testResults = arr('testResults');
  const bodyCompositions = arr('bodyCompositions');
  const playerGoals = arr('playerGoals');
  const equipment = arr('equipment');
  const qcFlags = arr('qcFlags');
  const importJobs = arr('importJobs');
  const auditLogs = arr('auditLogs');

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

      // Вставляем родителей → детей, сохраняя исходные id и связи
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
    },
  });
}