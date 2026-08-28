import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { APPLICATION_USER, BOOTSTRAP_USER, DEFAULT_DATABASE, DEMO_DATABASE, buildLocalDatabaseUrl, ensureApplicationDatabase, ensureDemoDatabase, executeSql, initializeCluster, resolvePostgresPaths, startPostgres } from '../dist/main/postgres.js';

const repo = path.resolve(import.meta.dirname, '../../..');
const resourcesPath = path.join(repo, 'apps/desktop/.runtime');
const prismaRoot = path.join(resourcesPath, 'db');
const temporaryRoot = await mkdtemp('C:\\Temp\\pasko_phase76_demo_');
const credentials = { bootstrapPassword: randomBytes(32).toString('base64url'), applicationPassword: randomBytes(32).toString('base64url') };
const paths = resolvePostgresPaths({ resourcesPath, localAppData: temporaryRoot, dataRoot: temporaryRoot });
let postgres;

function run(entry, args, env) {
  return new Promise((resolve) => { const child = spawn(process.execPath, [entry, ...args], { cwd: prismaRoot, windowsHide: true, env: { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, ...env }, stdio: ['ignore', 'ignore', 'pipe'] }); child.once('error', () => resolve(-1)); child.once('exit', (code) => resolve(code ?? -1)); });
}
const prismaEnv = (databaseUrl, extra = {}) => ({ DATABASE_URL: databaseUrl, PRISMA_SCHEMA_ENGINE_BINARY: path.join(prismaRoot, 'node_modules/@prisma/engines/schema-engine-windows.exe'), PRISMA_QUERY_ENGINE_LIBRARY: path.join(prismaRoot, 'node_modules/.prisma/client/query_engine-windows.dll.node'), PRISMA_HIDE_UPDATE_MESSAGE: '1', ...extra });
const migrate = (databaseUrl) => run(path.join(prismaRoot, 'node_modules/prisma/build/index.js'), ['migrate', 'deploy', '--schema', path.join(prismaRoot, 'prisma/schema.prisma')], prismaEnv(databaseUrl));

try {
  await initializeCluster(paths, credentials.bootstrapPassword); postgres = await startPostgres(paths, credentials.bootstrapPassword);
  await ensureApplicationDatabase(postgres, credentials); await ensureDemoDatabase(postgres, credentials);
  const productionUrl = buildLocalDatabaseUrl({ host: '127.0.0.1', port: postgres.port, database: DEFAULT_DATABASE, username: APPLICATION_USER, password: credentials.applicationPassword });
  const demoUrl = buildLocalDatabaseUrl({ host: '127.0.0.1', port: postgres.port, database: DEMO_DATABASE, username: APPLICATION_USER, password: credentials.applicationPassword });
  if (await migrate(productionUrl) !== 0 || await run(path.join(prismaRoot, 'bootstrap-reference.cjs'), [], prismaEnv(productionUrl)) !== 0) throw new Error('Production fixture bootstrap failed');
  await executeSql({ runtime: postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: DEFAULT_DATABASE, sql: `INSERT INTO organizations(id,name,code,"createdAt","updatedAt") VALUES ('real-org','Real Fixture Club','REAL_FIXTURE',now(),now());` });
  const productionBefore = await executeSql({ runtime: postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: DEFAULT_DATABASE, sql: `SELECT (SELECT count(*) FROM organizations),(SELECT count(*) FROM teams),(SELECT count(*) FROM players),(SELECT count(*) FROM test_results);` });
  if (await migrate(demoUrl) !== 0 || await run(path.join(prismaRoot, 'bootstrap-demo.cjs'), [], prismaEnv(demoUrl)) !== 0) throw new Error('Demo bootstrap failed');
  const productionAfterCreate = await executeSql({ runtime: postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: DEFAULT_DATABASE, sql: `SELECT (SELECT count(*) FROM organizations),(SELECT count(*) FROM teams),(SELECT count(*) FROM players),(SELECT count(*) FROM test_results);` });
  if (productionBefore !== productionAfterCreate) throw new Error('Demo creation changed production fixture');
  const counts = await executeSql({ runtime: postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: DEMO_DATABASE, sql: `SELECT (SELECT count(*) FROM organizations),(SELECT count(*) FROM teams),(SELECT count(*) FROM seasons),(SELECT count(*) FROM players),(SELECT count(*) FROM test_sessions),(SELECT count(*) FROM test_results),(SELECT count(*) FROM body_compositions),(SELECT count(*) FROM player_goals),(SELECT count(*) FROM test_results WHERE "qcStatus"='FAILED'),(SELECT count(*) FROM audit_logs WHERE action='PASKO_DEMO_VOLLEYBALL_V1');` });
  if (counts !== '1|1|1|14|56|504|56|3|1|1') throw new Error(`Unexpected Demo dataset counts: ${counts}`);
  const composition = await executeSql({ runtime: postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: DEMO_DATABASE, sql: `SELECT string_agg(position||':'||n,',' ORDER BY position) FROM (SELECT position,count(*) n FROM players GROUP BY position) p;` });
  if (composition !== 'libero:2,middle_blocker:3,opposite:3,outside_hitter:4,setter:2') throw new Error(`Unexpected roster: ${composition}`);
  const timeline = await executeSql({ runtime: postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: DEMO_DATABASE, sql: `SELECT count(DISTINCT "DateTime") FROM test_sessions;` });
  if (timeline !== '4') throw new Error('Demo timeline is not four checkpoints');
  const science = await executeSql({ runtime: postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: DEMO_DATABASE, sql: `SELECT (SELECT count(*) FROM norm_entries e JOIN tests t ON t.id=e.test_id WHERE t.code='VB_APP' AND e.position='middle_blocker' AND e.mean=349 AND e.sd=14),(SELECT count(*) FROM norm_entries e JOIN tests t ON t.id=e.test_id WHERE t.code='PWR_CMJ' AND e.mean=42 AND e.sd=6),(SELECT count(*) FROM norm_entries e JOIN tests t ON t.id=e.test_id WHERE t.code='BC_FAT' AND e.interpretation_type='POOLED_ESTIMATE' AND e.p10 IS NULL);` });
  if (science !== '1|1|1') throw new Error(`Demo science fixture mismatch: ${science}`);
  const qcIsolation = await executeSql({ runtime: postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: DEMO_DATABASE, sql: `SELECT (SELECT count(*) FROM test_results WHERE "qcStatus"='FAILED'),(SELECT count(*) FROM test_results WHERE "qcStatus"='FAILED' AND (score IS NOT NULL OR "pbAchieved"=true));` });
  if (qcIsolation !== '1|0') throw new Error(`QC fixture contributes downstream: ${qcIsolation}`);
  await executeSql({ runtime: postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: DEMO_DATABASE, sql: `UPDATE players SET "firstName"='Изменено' WHERE id='demo-player-01';` });
  await executeSql({ runtime: postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: DEMO_DATABASE, sql: `DELETE FROM audit_logs WHERE id='demo-reference-compatibility';` });
  if (await run(path.join(prismaRoot, 'bootstrap-demo.cjs'), [], prismaEnv(demoUrl)) !== 0) throw new Error('Existing Demo profile compatibility upgrade failed');
  const upgrade = await executeSql({ runtime: postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: DEMO_DATABASE, sql: `SELECT (SELECT "firstName" FROM players WHERE id='demo-player-01'),(SELECT count(*) FROM test_results),(SELECT count(*) FROM audit_logs WHERE id='demo-reference-compatibility');` });
  if (upgrade !== 'Изменено|504|1') throw new Error('Existing Demo upgrade changed player/results or omitted compatibility declaration');
  if (await run(path.join(prismaRoot, 'bootstrap-demo.cjs'), [], prismaEnv(demoUrl, { PASKO_DEMO_RESET: '1' })) !== 0) throw new Error('Demo reset failed');
  const resetName = await executeSql({ runtime: postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: DEMO_DATABASE, sql: `SELECT "firstName" FROM players WHERE id='demo-player-01';` });
  if (resetName !== 'Антон') throw new Error('Demo reset did not restore canonical baseline');
  if (await run(path.join(prismaRoot, 'bootstrap-demo.cjs'), [], prismaEnv(productionUrl, { PASKO_DEMO_RESET: '1' })) === 0) throw new Error('Production DB accepted Demo reset');
  const productionAfterReset = await executeSql({ runtime: postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: DEFAULT_DATABASE, sql: `SELECT (SELECT count(*) FROM organizations),(SELECT count(*) FROM teams),(SELECT count(*) FROM players),(SELECT count(*) FROM test_results);` });
  if (productionBefore !== productionAfterReset) throw new Error('Rejected Demo reset changed production fixture');
  if (await run(path.join(prismaRoot, 'bootstrap-demo.cjs'), [], prismaEnv(demoUrl)) !== 0) throw new Error('Repeated Demo initialization failed');
  const idempotent = await executeSql({ runtime: postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: DEMO_DATABASE, sql: `SELECT (SELECT count(*) FROM players),(SELECT count(*) FROM test_sessions),(SELECT count(*) FROM test_results);` });
  if (idempotent !== '14|56|504') throw new Error(`Demo initialization duplicated rows: ${idempotent}`);
  console.log('Demo DB integration PASS: separate exact database, 14-player deterministic dataset, four checkpoints, references, QC fixture, idempotence, reset, production isolation, arbitrary target rejection');
} finally { if (postgres) await postgres.stop().catch(() => undefined); await rm(temporaryRoot, { recursive: true, force: true }); }
