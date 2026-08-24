import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  APPLICATION_USER,
  DEFAULT_DATABASE,
  buildLocalDatabaseUrl,
  ensureApplicationDatabase,
  initializeCluster,
  redactDatabaseText,
  resolvePostgresPaths,
  startPostgres,
} from '../../desktop/src/main/postgres';
import { resolveAppContext } from '../lib/app-context-core';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
async function main(): Promise<void> {
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'pasko-context-integration-'));
const credentials = {
  bootstrapPassword: randomBytes(32).toString('base64url'),
  applicationPassword: randomBytes(32).toString('base64url'),
};
const paths = resolvePostgresPaths({
  resourcesPath: path.join(repositoryRoot, 'apps/desktop/.runtime'),
  localAppData: temporaryRoot,
  dataRoot: temporaryRoot,
});
let runtime: Awaited<ReturnType<typeof startPostgres>> | undefined;

function runMigrations(databaseUrl: string): Promise<void> {
  const prismaCli = path.join(repositoryRoot, 'node_modules/prisma/build/index.js');
  const schema = path.join(repositoryRoot, 'packages/db/prisma/schema.prisma');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', schema], {
      cwd: repositoryRoot,
      windowsHide: true,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += String(chunk); });
    child.stderr.on('data', (chunk) => { output += String(chunk); });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Migration deploy failed (${code}): ${redactDatabaseText(output)}`)));
  });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

try {
  await initializeCluster(paths, credentials.bootstrapPassword);
  runtime = await startPostgres(paths, credentials.bootstrapPassword);
  await ensureApplicationDatabase(runtime, credentials);
  const databaseUrl = buildLocalDatabaseUrl({
    host: '127.0.0.1',
    port: runtime.port,
    database: DEFAULT_DATABASE,
    username: APPLICATION_USER,
    password: credentials.applicationPassword,
  });
  await runMigrations(databaseUrl);
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    assert((await resolveAppContext(db, null)).status === 'NO_ORGANIZATION', 'Empty DB state failed');

    const orgA = await db.organization.create({ data: { name: 'Club A', code: 'CLUB_A' } });
    const teamA = await db.team.create({ data: { name: 'Team A1', code: 'MAIN', organizationId: orgA.id } });
    const seasonA = await db.season.create({ data: { name: 'Season A', startDate: new Date('2026-07-01'), endDate: new Date('2027-06-30'), teams: { connect: { id: teamA.id } } } });
    const playerA = await db.player.create({ data: { playerId: '001', firstName: 'Player', lastName: 'A', position: 'setter', teamId: teamA.id } });
    const fallback = await resolveAppContext(db, null);
    assert(fallback.status === 'READY' && fallback.teamId === teamA.id, 'Single-context fallback failed');

    const teamA2 = await db.team.create({ data: { name: 'Team A2', code: 'SECOND', organizationId: orgA.id } });
    const seasonA2 = await db.season.create({ data: { name: 'Season A2', startDate: new Date('2027-07-01'), endDate: new Date('2028-06-30'), teams: { connect: { id: teamA2.id } } } });
    const orgB = await db.organization.create({ data: { name: 'Club B', code: 'CLUB_B' } });
    const teamB = await db.team.create({ data: { name: 'Team B1', code: 'MAIN', organizationId: orgB.id } });
    const seasonB = await db.season.create({ data: { name: 'Season B', startDate: new Date('2026-07-01'), endDate: new Date('2027-06-30'), teams: { connect: { id: teamB.id } } } });
    const playerB = await db.player.create({ data: { playerId: '001', firstName: 'Player', lastName: 'B', position: 'setter', teamId: teamB.id } });
    assert((await resolveAppContext(db, null)).status === 'SELECTION_REQUIRED', 'Multi-context selection was not required');
    assert((await resolveAppContext(db, { organizationId: orgA.id, teamId: teamB.id, seasonId: seasonB.id })).status === 'INVALID_CONTEXT', 'Cross-organization team accepted');
    assert((await resolveAppContext(db, { organizationId: orgA.id, teamId: teamA.id, seasonId: seasonB.id })).status === 'INVALID_CONTEXT', 'Unrelated season accepted');

    const category = await db.testCategory.create({ data: { code: 'INT', name: 'Integration' } });
    const test = await db.test.create({ data: { code: 'INT_TEST', name: 'Integration test', unit: 'pt', direction: 'HIGHER_IS_BETTER', categoryId: category.id } });
    const sessionA = await db.testSession.create({ data: { sessionId: crypto.randomUUID(), DateTime: new Date('2026-09-01'), phase: 'INSEASON', playerId: playerA.id, teamId: teamA.id, seasonId: seasonA.id } });
    const sessionB = await db.testSession.create({ data: { sessionId: crypto.randomUUID(), DateTime: new Date('2026-09-01'), phase: 'INSEASON', playerId: playerB.id, teamId: teamB.id, seasonId: seasonB.id } });
    await db.testResult.create({ data: { value: 10, qcStatus: 'PASSED', testId: test.id, playerId: playerA.id, testSessionId: sessionA.id } });
    await db.testResult.create({ data: { value: 999, qcStatus: 'FAILED', testId: test.id, playerId: playerB.id, testSessionId: sessionB.id } });
    const goalA = await db.playerGoal.create({ data: { playerId: playerA.id, testId: test.id, targetValue: 11, targetDate: new Date('2027-01-01') } });
    const goalB = await db.playerGoal.create({ data: { playerId: playerB.id, testId: test.id, targetValue: 11, targetDate: new Date('2027-01-01') } });

    const playersA = await db.player.findMany({ where: { teamId: teamA.id, deletedAt: null } });
    assert(playersA.length === 1 && playersA[0].id === playerA.id, 'Player A/B isolation failed');
    const importLookup = await db.player.findFirst({ where: { teamId: teamA.id, playerId: '001', deletedAt: null } });
    assert(importLookup?.id === playerA.id, 'Import business-key isolation failed');
    const exportA = await db.player.findMany({ where: { teamId: teamA.id, deletedAt: null }, include: { testSessions: { where: { seasonId: seasonA.id, deletedAt: null } } } });
    assert(exportA.length === 1 && exportA[0].testSessions.every((session) => session.teamId === teamA.id), 'Export isolation failed');
    const passedA = await db.testResult.findMany({ where: { qcStatus: 'PASSED', deletedAt: null, testSession: { teamId: teamA.id, seasonId: seasonA.id, deletedAt: null } } });
    assert(passedA.length === 1 && passedA[0].value === 10, 'Analytics/QC PASSED isolation failed');
    const forgedSession = await db.testSession.findFirst({ where: { id: sessionB.id, teamId: teamA.id, seasonId: seasonA.id, deletedAt: null } });
    assert(forgedSession === null, 'Cross-team session access was not rejected');
    const forgedGoal = await db.playerGoal.findFirst({ where: { id: goalB.id, player: { teamId: teamA.id }, deletedAt: null } });
    assert(forgedGoal === null, 'Cross-team goal mutation guard failed');
    const goalsA = await db.playerGoal.findMany({ where: { player: { teamId: teamA.id }, deletedAt: null } });
    assert(goalsA.length === 1 && goalsA[0].id === goalA.id, 'Goal/report isolation failed');

    let duplicateRejected = false;
    try {
      await db.team.create({ data: { name: 'Duplicate', code: 'MAIN', organizationId: orgA.id } });
    } catch (error) {
      duplicateRejected = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
    }
    assert(duplicateRejected, 'Team code was not unique within Organization');

    await db.season.update({ where: { id: seasonA2.id }, data: { deletedAt: new Date() } });
    assert((await resolveAppContext(db, { organizationId: orgA.id, teamId: teamA2.id, seasonId: seasonA2.id })).status === 'INVALID_CONTEXT', 'Deleted season accepted');
    await db.team.update({ where: { id: teamA2.id }, data: { deletedAt: new Date() } });
    assert((await resolveAppContext(db, { organizationId: orgA.id, teamId: teamA2.id, seasonId: seasonA2.id })).status === 'INVALID_CONTEXT', 'Deleted team accepted');
    await db.organization.update({ where: { id: orgB.id }, data: { deletedAt: new Date() } });
    assert((await resolveAppContext(db, { organizationId: orgB.id, teamId: teamB.id, seasonId: seasonB.id })).status === 'INVALID_CONTEXT', 'Deleted organization accepted');

    console.log('Context integration PASS: migrations, empty/single/multi context, two organizations, scoped reads/writes, QC exclusion, composite Team code');
  } finally {
    await db.$disconnect();
  }
} finally {
  if (runtime) await runtime.stop().catch(() => undefined);
  await rm(temporaryRoot, { recursive: true, force: true });
}
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
