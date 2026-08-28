import type { Prisma, PrismaClient } from '@prisma/client';
import { PASKO_REFERENCE_V1_CODE, seedReferenceData } from './reference-data';
import { demoTimeline, timelineMetadata, DEMO_TIMELINE_VERSION } from './demo-timeline';

export const PASKO_DEMO_DATASET_CODE = 'PASKO_DEMO_VOLLEYBALL_V1';
export const PASKO_DEMO_DATASET_VERSION = '1.0';
export const PASKO_DEMO_DATABASE = 'pasko_performance_demo';
export const DEMO_ORGANIZATION_CODE = 'PASKO_DEMO';
export const DEMO_TEAM_CODE = 'PASKO_DEMO_VOLLEYBALL';
export const DEMO_SEASON_ID = 'demo-season-2026-27';

type Db = Prisma.TransactionClient | PrismaClient;
const RESET_CAPABILITY = Symbol('PASKO_DEMO_RESET_CAPABILITY');

export function assertDemoDatabaseUrl(value: string | undefined): void {
  if (!value) throw new Error('DEMO_DATABASE_URL_MISSING');
  const parsed = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || decodeURIComponent(parsed.pathname.slice(1)) !== PASKO_DEMO_DATABASE)
    throw new Error('DEMO_DATABASE_IDENTITY_REJECTED');
}

const roster = [
  ['D01', 'Антон', 'Белов', 1, 'setter', 194], ['D02', 'Роман', 'Жуков', 9, 'setter', 192],
  ['D03', 'Максим', 'Орлов', 5, 'outside_hitter', 198], ['D04', 'Егор', 'Лебедев', 7, 'outside_hitter', 201],
  ['D05', 'Кирилл', 'Савельев', 12, 'outside_hitter', 196], ['D06', 'Никита', 'Власов', 17, 'outside_hitter', 200],
  ['D07', 'Илья', 'Миронов', 3, 'middle_blocker', 205], ['D08', 'Денис', 'Громов', 11, 'middle_blocker', 207],
  ['D09', 'Арсений', 'Титов', 15, 'middle_blocker', 204], ['D10', 'Павел', 'Соколов', 4, 'opposite', 202],
  ['D11', 'Вадим', 'Крылов', 8, 'opposite', 203], ['D12', 'Степан', 'Рябов', 18, 'opposite', 200],
  ['D13', 'Александр', 'Фомин', 6, 'libero', 184], ['D14', 'Олег', 'Нестеров', 14, 'libero', 186],
] as const;
const checkpoints = [
  ['PRESEASON', 'Предсезонное тестирование'],
  ['CAMP', 'Сборы'],
  ['INSEASON', 'Начало сезона'],
  ['INSEASON', 'Текущий контроль'],
] as const;
const baseValues: Record<string, number> = { PWR_CMJ: 39, SPD_10: 1.82, SPD_20: 3.18, AGI_TTEST: 9.75, VB_APP: 338, VB_BLOCK: 318, BC_MASS: 91, BC_FAT: 13.5, BC_FFM: 78.7 };
const progress: Record<string, number> = { PWR_CMJ: 1.2, SPD_10: -0.025, SPD_20: -0.035, AGI_TTEST: -0.08, VB_APP: 2.1, VB_BLOCK: 1.5, BC_MASS: 0.1, BC_FAT: -0.25, BC_FFM: 0.3 };

// Known synthetic adult male volleyball cohort, not an inference about user data.
async function confirmSyntheticReference(db: Db) {
  const team = await db.team.findUnique({ where: { id: 'demo-team' }, include: { activeNormProfile: true } });
  const profile = team?.activeNormProfile;
  if (team?.organizationId !== 'demo-organization' || profile?.code !== PASKO_REFERENCE_V1_CODE) return;
  await db.auditLog.upsert({ where: { id: 'demo-reference-compatibility' }, update: {}, create: { id: 'demo-reference-compatibility', action: 'REFERENCE_PROFILE_COMPATIBILITY_CONFIRMED', entity: 'Team', entityId: team.id, newValues: { profileId: profile.id, version: profile.version, sport: profile.sport, sex: profile.sex, ageGroup: profile.ageGroup, level: profile.level } } });
}

async function clearDemo(db: Db, capability: symbol): Promise<void> {
  if (capability !== RESET_CAPABILITY) throw new Error('DEMO_RESET_CAPABILITY_REJECTED');
  await db.qCFlag.deleteMany(); await db.testResult.deleteMany(); await db.bodyComposition.deleteMany();
  await db.playerGoal.deleteMany(); await db.testSession.deleteMany(); await db.normEntrySource.deleteMany();
  await db.normEntry.deleteMany(); await db.team.updateMany({ data: { activeNormProfileId: null } });
  await db.normProfile.deleteMany(); await db.referenceSource.deleteMany(); await db.test.deleteMany();
  await db.testCategory.deleteMany(); await db.player.deleteMany(); await db.season.deleteMany();
  await db.team.deleteMany(); await db.organization.deleteMany(); await db.equipment.deleteMany();
  await db.importJob.deleteMany(); await db.auditLog.deleteMany();
}

async function seedDemoData(db: Db, capability: symbol, now: Date): Promise<void> {
  const timeline = demoTimeline(now);
  await clearDemo(db, capability);
  const { tests } = await seedReferenceData(db as Prisma.TransactionClient);
  const testsByCode = new Map(tests.map((test) => [test.code, test]));
  const profile = await db.normProfile.findUniqueOrThrow({ where: { code: PASKO_REFERENCE_V1_CODE } });
  await db.organization.create({ data: { id: 'demo-organization', name: 'PASKO Demo Club', shortName: 'PASKO DEMO', code: DEMO_ORGANIZATION_CODE } });
  await db.team.create({ data: { id: 'demo-team', name: 'PASKO Demo Volleyball', code: DEMO_TEAM_CODE, organizationId: 'demo-organization', activeNormProfileId: profile.id } });
  await confirmSyntheticReference(db);
  await db.season.create({ data: { id: DEMO_SEASON_ID, ...timeline.season, teams: { connect: { id: 'demo-team' } } } });
  await db.player.createMany({ data: roster.map(([playerId, firstName, lastName, number, position, height], index) => ({ id: `demo-player-${String(index + 1).padStart(2, '0')}`, playerId, firstName, lastName, number, position, height, status: 'ACTIVE', teamId: 'demo-team', birthDate: new Date(`${1995 + (index % 7)}-${String((index % 9) + 1).padStart(2, '0')}-15T00:00:00.000Z`) })) });
  for (let playerIndex = 0; playerIndex < roster.length; playerIndex += 1) {
    const playerId = `demo-player-${String(playerIndex + 1).padStart(2, '0')}`;
    for (let checkpointIndex = 0; checkpointIndex < checkpoints.length; checkpointIndex += 1) {
      const [phase, label] = checkpoints[checkpointIndex];
      const date = timeline.checkpoints[checkpointIndex];
      const sessionId = `demo-session-${playerIndex + 1}-${checkpointIndex + 1}`;
      await db.testSession.create({ data: { id: sessionId, sessionId, DateTime: new Date(date), phase, status: 'FULL', source: 'MANUAL', comment: label, playerId, teamId: 'demo-team', seasonId: DEMO_SEASON_ID } });
      const offset = (playerIndex % 5) - 2;
      for (const [code, base] of Object.entries(baseValues)) {
        const test = testsByCode.get(code); if (!test) throw new Error(`DEMO_TEST_MISSING:${code}`);
        let value = base + offset * (code.startsWith('VB_') ? 2.5 : code.startsWith('BC_') ? 0.6 : 0.22) + progress[code] * checkpointIndex;
        if (playerIndex === 4 && checkpointIndex === 2 && code === 'PWR_CMJ') value -= 2.5;
        if (playerIndex === 6 && checkpointIndex === 3 && code === 'PWR_CMJ') value = 46.2;
        const failed = playerIndex === 13 && checkpointIndex === 0 && code === 'PWR_CMJ'; if (failed) value = 95;
        const contextual = code.startsWith('BC_');
        const resultId = `demo-result-${playerIndex + 1}-${checkpointIndex + 1}-${code.toLowerCase()}`;
        await db.testResult.create({ data: { id: resultId, value: Number(value.toFixed(2)), score: contextual || failed ? null : Math.max(12, Math.min(94, 48 + offset * 4 + checkpointIndex * 5)), pbAchieved: !failed && checkpointIndex === 3, testId: test.id, playerId, testSessionId: sessionId, qcStatus: failed ? 'FAILED' : 'PASSED', source: 'MANUAL' } });
        if (failed) await db.qCFlag.create({ data: { id: 'demo-qc-outlier', testResultId: resultId, field: 'value', expected: '20–80 cm', actual: '95 cm', description: 'Демонстрационный выброс: результат исключён из аналитики.' } });
      }
      await db.bodyComposition.create({ data: { id: `demo-body-${playerIndex + 1}-${checkpointIndex + 1}`, playerId, testSessionId: sessionId, mass_kg: Number((baseValues.BC_MASS + offset * 0.6 + checkpointIndex * 0.1).toFixed(1)), fat_pct: Number((baseValues.BC_FAT + offset * 0.25 - checkpointIndex * 0.2).toFixed(1)), ffm_kg: Number((baseValues.BC_FFM + offset * 0.4 + checkpointIndex * 0.3).toFixed(1)) } });
    }
  }
  const cmj = testsByCode.get('PWR_CMJ')!; const sprint = testsByCode.get('SPD_10')!; const attack = testsByCode.get('VB_APP')!;
  await db.playerGoal.createMany({ data: [
    { id: 'demo-goal-achieved', playerId: 'demo-player-07', testId: cmj.id, targetValue: 45, targetDate: timeline.goalDeadlines[0], achieved: true, achievedAt: timeline.anchor },
    { id: 'demo-goal-active', playerId: 'demo-player-03', testId: attack.id, targetValue: 352, targetDate: timeline.goalDeadlines[1] },
    { id: 'demo-goal-near', playerId: 'demo-player-05', testId: sprint.id, targetValue: 1.68, targetDate: timeline.goalDeadlines[2] },
  ] });
  await db.auditLog.create({ data: { id: 'demo-dataset-identity', action: PASKO_DEMO_DATASET_CODE, entity: 'DemoDataset', entityId: PASKO_DEMO_DATASET_VERSION, newValues: { version: PASKO_DEMO_DATASET_VERSION, synthetic: true, ...timelineMetadata(now) } } });
}

async function assertConnectedDemo(prisma: PrismaClient) {
  const rows = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  if (rows[0]?.name !== PASKO_DEMO_DATABASE) throw new Error('DEMO_DATABASE_IDENTITY_REJECTED');
}

async function normalizeLegacyTimeline(db: Prisma.TransactionClient, now: Date) {
  const marker = await db.auditLog.findUniqueOrThrow({ where: { id: 'demo-dataset-identity' } });
  if (marker.action !== PASKO_DEMO_DATASET_CODE || marker.entityId !== PASKO_DEMO_DATASET_VERSION) throw new Error('DEMO_DATASET_MARKER_REJECTED');
  const metadata = marker.newValues && typeof marker.newValues === 'object' && !Array.isArray(marker.newValues) ? marker.newValues : {};
  if (metadata.timelineVersion !== undefined) {
    if (metadata.timelineVersion !== DEMO_TIMELINE_VERSION || typeof metadata.anchor !== 'string' || !Number.isFinite(Date.parse(metadata.anchor))) throw new Error('DEMO_TIMELINE_MARKER_REJECTED');
    return;
  }
  const team = await db.team.findFirst({ where: { id: 'demo-team', code: DEMO_TEAM_CODE, organization: { id: 'demo-organization', code: DEMO_ORGANIZATION_CODE } } });
  if (!team) throw new Error('DEMO_SYNTHETIC_IDENTITY_REJECTED');
  const timeline = demoTimeline(now);
  for (let p = 1; p <= roster.length; p++) {
    for (let c = 1; c <= checkpoints.length; c++) {
      await db.testSession.updateMany({ where: { id: `demo-session-${p}-${c}`, sessionId: `demo-session-${p}-${c}`, playerId: `demo-player-${String(p).padStart(2, '0')}`, teamId: team.id, seasonId: DEMO_SEASON_ID }, data: { DateTime: timeline.checkpoints[c - 1] } });
    }
  }
  await db.season.updateMany({ where: { id: DEMO_SEASON_ID, teams: { some: { id: team.id } } }, data: timeline.season });
  for (const [i, id] of ['demo-goal-achieved', 'demo-goal-active', 'demo-goal-near'].entries()) {
    const goal = await db.playerGoal.findFirst({ where: { id, player: { teamId: team.id } } });
    if (goal) await db.playerGoal.update({ where: { id }, data: { targetDate: timeline.goalDeadlines[i], achievedAt: goal.achieved ? timeline.anchor : null } });
  }
  await db.auditLog.update({ where: { id: marker.id }, data: { newValues: { ...metadata, ...timelineMetadata(now) } } });
}

export async function initializeDemoDatabase(prisma: PrismaClient, databaseUrl = process.env.DATABASE_URL): Promise<void> {
  assertDemoDatabaseUrl(databaseUrl);
  await assertConnectedDemo(prisma);
  const existingMarker = await prisma.auditLog.findUnique({ where: { id: 'demo-dataset-identity' } });
  if (existingMarker) {
    if (existingMarker.action !== PASKO_DEMO_DATASET_CODE || existingMarker.entityId !== PASKO_DEMO_DATASET_VERSION) throw new Error('DEMO_DATASET_MARKER_REJECTED');
    await prisma.$transaction(tx => normalizeLegacyTimeline(tx, new Date()), { maxWait: 10_000, timeout: 120_000 });
    await confirmSyntheticReference(prisma);
    return;
  }
  const businessRows = await prisma.organization.count();
  if (businessRows !== 0) throw new Error('UNMARKED_DEMO_DATABASE_NOT_EMPTY');
  await prisma.$transaction((tx) => seedDemoData(tx, RESET_CAPABILITY, new Date()), { maxWait: 10_000, timeout: 120_000 });
}

export async function resetDemoDatabase(prisma: PrismaClient, databaseUrl = process.env.DATABASE_URL): Promise<void> {
  assertDemoDatabaseUrl(databaseUrl);
  await assertConnectedDemo(prisma);
  const marker = await prisma.auditLog.findUnique({ where: { id: 'demo-dataset-identity' } });
  if (!marker || marker.action !== PASKO_DEMO_DATASET_CODE || marker.entityId !== PASKO_DEMO_DATASET_VERSION) throw new Error('DEMO_DATASET_MARKER_REJECTED');
  await prisma.$transaction((tx) => seedDemoData(tx, RESET_CAPABILITY, new Date()), { maxWait: 10_000, timeout: 120_000 });
}
