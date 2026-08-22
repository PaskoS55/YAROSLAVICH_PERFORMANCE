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
  if (confirm !== 'RESTORE') {
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

  const requiredArrays = [
    'organizations',
    'teams',
    'seasons',
    'testCategories',
    'players',
    'tests',
    'norms',
    'testSessions',
    'testResults',
    'bodyCompositions',
    'playerGoals',
    'equipment',
    'qcFlags',
    'importJobs',
    'auditLogs',
    'teamSeasonLinks',
  ];
  const malformedArray = requiredArrays.find((key) => !Array.isArray(backup[key]));
  if ((backup as { version?: unknown }).version !== 3 || malformedArray) {
    return NextResponse.json(
      { error: 'Неподдерживаемая версия или неполная структура резервной копии.' },
      { status: 400 }
    );
  }

  const ids = <T extends { id: string }>(rows: T[]) => new Set(rows.map((row) => row.id));
  const duplicateId = <T extends { id: string }>(rows: T[]) =>
    rows.some((row, index) => !row.id || rows.findIndex((candidate) => candidate.id === row.id) !== index);
  const organizationIds = ids(organizations);
  const teamIds = ids(teams);
  const seasonIds = ids(seasons);
  const categoryIds = ids(testCategories);
  const playerIds = ids(players);
  const testIds = ids(tests);
  const sessionIds = ids(testSessions);
  const resultIds = ids(testResults);
  const equipmentIds = ids(equipment);
  const sessionById = new Map(testSessions.map((session) => [session.id, session]));
  const teamSeasonKeys = new Set(teamSeasonLinks.map((link) => `${link.teamId}\u0000${link.seasonId}`));

  const invalidIds = [
    organizations,
    teams,
    seasons,
    testCategories,
    players,
    tests,
    norms,
    testSessions,
    testResults,
    bodyCompositions,
    playerGoals,
    equipment,
    qcFlags,
    importJobs,
    auditLogs,
  ].some((rows) => duplicateId(rows as { id: string }[]));
  const invalidReferences =
    teams.some((team) => !organizationIds.has(team.organizationId)) ||
    players.some((player) => !teamIds.has(player.teamId)) ||
    tests.some((test) => test.categoryId !== null && !categoryIds.has(test.categoryId)) ||
    testSessions.some(
      (session) =>
        !playerIds.has(session.playerId) ||
        !teamIds.has(session.teamId) ||
        !seasonIds.has(session.seasonId) ||
        !teamSeasonKeys.has(`${session.teamId}\u0000${session.seasonId}`) ||
        players.find((player) => player.id === session.playerId)?.teamId !== session.teamId
    ) ||
    testResults.some((result) => {
      const session = sessionById.get(result.testSessionId);
      return (
        !session ||
        !testIds.has(result.testId) ||
        !playerIds.has(result.playerId) ||
        session.playerId !== result.playerId ||
        (result.equipmentId !== null && !equipmentIds.has(result.equipmentId))
      );
    }) ||
    bodyCompositions.some(
      (body) =>
        !playerIds.has(body.playerId) ||
        !sessionIds.has(body.testSessionId) ||
        sessionById.get(body.testSessionId)?.playerId !== body.playerId
    ) ||
    playerGoals.some((goal) => !playerIds.has(goal.playerId) || !testIds.has(goal.testId)) ||
    norms.some((norm) => norm.testId !== null && !testIds.has(norm.testId)) ||
    qcFlags.some((flag) => !resultIds.has(flag.testResultId)) ||
    teamSeasonLinks.some((link) => !teamIds.has(link.teamId) || !seasonIds.has(link.seasonId));
  const duplicateBusinessKeys =
    new Set(organizations.map((organization) => organization.code)).size !== organizations.length ||
    new Set(teams.map((team) => `${team.organizationId}\u0000${team.code}`)).size !== teams.length ||
    teamSeasonKeys.size !== teamSeasonLinks.length ||
    new Set(players.map((player) => `${player.teamId}\u0000${player.playerId}`)).size !== players.length ||
    new Set(testSessions.map((session) => `${session.playerId}\u0000${session.DateTime}\u0000${session.phase}`))
      .size !== testSessions.length ||
    new Set(testResults.map((result) => `${result.testSessionId}\u0000${result.testId}`)).size !==
      testResults.length;

  if (invalidIds || invalidReferences || duplicateBusinessKeys) {
    return NextResponse.json(
      { error: 'Резервная копия содержит дубликаты или несогласованные связи.' },
      { status: 400 }
    );
  }

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
