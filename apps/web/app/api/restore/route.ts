import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { revalidatePath } from 'next/cache';
import { validateReferenceFields } from '../../../lib/reference-policy';
import { requireCurrentUser } from '../../../lib/current-user';
import { verifyPassword } from '../../../lib/local-auth';
import type {
  Organization,
  Team,
  Season,
  TestCategory,
  Player,
  Test,
  NormProfile,
  NormEntry,
  ReferenceSource,
  NormEntrySource,
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
  const user = await requireCurrentUser();
  const password = req.headers.get('X-Restore-Password') ?? '';
  if (!password || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: 'Текущий пароль локального администратора не подтверждён.' }, { status: 403 });
  }

  let backup: Record<string, unknown>;
  try {
    backup = await req.json();
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON-файл.' }, { status: 400 });
  }

  if (
    !backup || typeof backup !== 'object' || Array.isArray(backup) ||
    (backup as { brand?: string }).brand !== 'PASKO PERFORMANCE' ||
    (backup.product !== undefined && backup.product !== 'PASKO PERFORMANCE PLATFORM') ||
    (backup.sportVertical !== undefined && backup.sportVertical !== 'VOLLEYBALL') ||
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
  const normProfiles = arr<NormProfile>('normProfiles');
  const normEntries = arr<NormEntry>('normEntries');
  const referenceSources = arr<ReferenceSource>('referenceSources');
  const normEntrySources = arr<NormEntrySource>('normEntrySources');
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
    'normProfiles',
    'normEntries',
    'referenceSources',
    'normEntrySources',
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
  const formatVersion = (backup as { formatVersion?: unknown; version?: unknown }).formatVersion ?? (backup as { version?: unknown }).version;
  if (formatVersion !== 4 || malformedArray) {
    return NextResponse.json(
      { error: 'Неподдерживаемая версия или неполная структура резервной копии.' },
      { status: 400 }
    );
  }

  // Reject malformed rows before traversing IDs/relations. Prisma validates
  // individual model fields later, inside the all-or-nothing transaction.
  const invalidRows = requiredArrays.some(key => (backup[key] as unknown[]).some(row =>
    !row || typeof row !== 'object' || Array.isArray(row)));
  const invalidReferenceDates = normEntries.some(entry => entry &&
    [entry.validFrom, entry.validUntil].some(date => date != null &&
      (typeof date !== 'string' || !Number.isFinite(new Date(date).getTime()))));
  if (invalidRows || invalidReferenceDates) {
    return NextResponse.json({ error: 'Резервная копия содержит некорректные записи или даты.' }, { status: 400 });
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
  const profileIds = ids(normProfiles);
  const entryIds = ids(normEntries);
  const sourceIds = ids(referenceSources);
  const profileById = new Map(normProfiles.map((profile) => [profile.id, profile]));
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
    normProfiles,
    normEntries,
    referenceSources,
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
    normProfiles.some((profile) =>
      (profile.organizationId !== null && !organizationIds.has(profile.organizationId)) ||
      (profile.scope === 'ORGANIZATION' ? profile.organizationId === null : profile.organizationId !== null) ||
      (profile.baseProfileId !== null && !profileIds.has(profile.baseProfileId))
    ) ||
    normEntries.some((entry) => !profileIds.has(entry.profileId) || !testIds.has(entry.testId) || validateReferenceFields(entry) !== null) ||
    normEntrySources.some((link) => !entryIds.has(link.entryId) || !sourceIds.has(link.sourceId)) ||
    teams.some((team) => {
      if (team.activeNormProfileId === null) return false;
      const profile = profileById.get(team.activeNormProfileId);
      return !profile || profile.deletedAt !== null || profile.status !== 'ACTIVE' ||
        (profile.scope !== 'SYSTEM' && (profile.scope !== 'ORGANIZATION' || profile.organizationId !== team.organizationId));
    }) ||
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
      testResults.length ||
    new Set(normEntries.map((entry) => `${entry.profileId}\u0000${entry.testId}\u0000${entry.position ?? '*'}\u0000${entry.validFrom ? new Date(entry.validFrom).toISOString() : '*'}\u0000${entry.validUntil ? new Date(entry.validUntil).toISOString() : '*'}`)).size !== normEntries.length ||
    new Set(normEntrySources.map((link) => `${link.entryId}\u0000${link.sourceId}`)).size !== normEntrySources.length;

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
      await tx.normEntrySource.deleteMany();
      await tx.normEntry.deleteMany();
      await tx.team.updateMany({ data: { activeNormProfileId: null } });
      await tx.normProfile.deleteMany();
      await tx.referenceSource.deleteMany();
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
      if (teams.length) await tx.team.createMany({ data: teams.map((team) => ({ ...team, activeNormProfileId: null })) });
      if (seasons.length) await tx.season.createMany({ data: seasons });
      if (testCategories.length) await tx.testCategory.createMany({ data: testCategories });
      if (equipment.length) await tx.equipment.createMany({ data: equipment });
      if (players.length) await tx.player.createMany({ data: players });
      if (tests.length) await tx.test.createMany({ data: tests });
      if (referenceSources.length) await tx.referenceSource.createMany({ data: referenceSources });
      if (normProfiles.length) await tx.normProfile.createMany({ data: normProfiles });
      if (normEntries.length) await tx.normEntry.createMany({ data: normEntries });
      if (normEntrySources.length) await tx.normEntrySource.createMany({ data: normEntrySources });
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
      for (const team of teams) {
        // Restoring relations must not manufacture a later modification date.
        await tx.team.update({ where: { id: team.id }, data: {
          activeNormProfileId: team.activeNormProfileId, updatedAt: team.updatedAt,
        } });
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
