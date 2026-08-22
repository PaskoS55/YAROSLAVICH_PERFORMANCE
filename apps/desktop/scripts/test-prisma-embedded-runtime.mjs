import { randomBytes } from 'node:crypto';
import { cp, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { APPLICATION_USER, BOOTSTRAP_USER, buildLocalDatabaseUrl, ensureApplicationDatabase, executeSql, initializeCluster, resolvePostgresPaths, startPostgres } from '../dist/main/postgres.js';

const repo = path.resolve(import.meta.dirname, '../../..');
const resourcesPath = path.join(repo, 'apps/desktop/.runtime');
const fullRuntime = path.join(resourcesPath, 'db');
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'pasko-prisma-embedded-'));
const credentials = { bootstrapPassword: randomBytes(32).toString('base64url'), applicationPassword: randomBytes(32).toString('base64url') };
const paths = resolvePostgresPaths({ resourcesPath, localAppData: temporaryRoot, dataRoot: temporaryRoot });
let postgres;
function runElectronNode(entry, args, env) { return new Promise((resolve) => { const child = spawn(process.execPath, [entry, ...args], { cwd: path.dirname(entry), windowsHide: true, env: { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, ...env }, stdio: ['ignore', 'ignore', 'pipe'] }); child.once('error', () => resolve(-1)); child.once('exit', (code) => resolve(code ?? -1)); }); }
async function migrate(runtimeRoot, databaseUrl) { return runElectronNode(path.join(runtimeRoot, 'node_modules/prisma/build/index.js'), ['migrate', 'deploy', '--schema', path.join(runtimeRoot, 'prisma/schema.prisma')], { DATABASE_URL: databaseUrl, PRISMA_SCHEMA_ENGINE_BINARY: path.join(runtimeRoot, 'node_modules/@prisma/engines/schema-engine-windows.exe'), PRISMA_HIDE_UPDATE_MESSAGE: '1' }); }

try {
  await initializeCluster(paths, credentials.bootstrapPassword); postgres = await startPostgres(paths, credentials.bootstrapPassword); await ensureApplicationDatabase(postgres, credentials);
  const appUrl = buildLocalDatabaseUrl({ host: '127.0.0.1', port: postgres.port, database: 'pasko_performance', username: APPLICATION_USER, password: credentials.applicationPassword });
  if (await migrate(fullRuntime, appUrl) !== 0) throw new Error('Fresh migrate deploy failed');
  const bootstrapEnv = { DATABASE_URL: appUrl, PRISMA_QUERY_ENGINE_LIBRARY: path.join(fullRuntime, 'node_modules/.prisma/client/query_engine-windows.dll.node') };
  if (await runElectronNode(path.join(fullRuntime, 'bootstrap-reference.cjs'), [], bootstrapEnv) !== 0) throw new Error('Fresh reference bootstrap failed');
  const fresh = await executeSql({ runtime: postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: 'pasko_performance', sql: 'SELECT (SELECT count(*) FROM test_categories),(SELECT count(*) FROM tests),(SELECT count(*) FROM organizations),(SELECT count(*) FROM teams),(SELECT count(*) FROM players),(SELECT count(*) FROM _prisma_migrations);' });
  if (fresh !== '7|16|0|0|0|3') throw new Error(`Unexpected fresh state: ${fresh}`);
  if (await migrate(fullRuntime, appUrl) !== 0 || await runElectronNode(path.join(fullRuntime, 'bootstrap-reference.cjs'), [], bootstrapEnv) !== 0) throw new Error('Second migrate/bootstrap failed');
  if (await executeSql({ runtime: postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: 'pasko_performance', sql: 'SELECT (SELECT count(*) FROM test_categories),(SELECT count(*) FROM tests),(SELECT count(*) FROM _prisma_migrations);' }) !== '7|16|3') throw new Error('Reference bootstrap is not idempotent');
  await executeSql({ runtime: postgres, username: BOOTSTRAP_USER, password: credentials.bootstrapPassword, database: 'postgres', sql: `CREATE DATABASE p5_upgrade OWNER ${APPLICATION_USER};` });
  const upgradeRoot = path.join(temporaryRoot, 'upgrade-runtime'); await cp(fullRuntime, upgradeRoot, { recursive: true }); await rm(path.join(upgradeRoot, 'prisma/migrations/20260821110000_add_multi_team_context_indexes'), { recursive: true, force: true });
  const upgradeUrl = buildLocalDatabaseUrl({ host: '127.0.0.1', port: postgres.port, database: 'p5_upgrade', username: APPLICATION_USER, password: credentials.applicationPassword });
  if (await migrate(upgradeRoot, upgradeUrl) !== 0) throw new Error('Previous schema migrate failed');
  await executeSql({ runtime: postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: 'p5_upgrade', sql: `INSERT INTO organizations(id,name,code,"createdAt","updatedAt") VALUES ('old_org','Old Club','OLD',now(),now()); INSERT INTO teams(id,name,code,"organizationId","createdAt","updatedAt") VALUES ('old_team','Old Team','MAIN','old_org',now(),now());` });
  if (await migrate(fullRuntime, upgradeUrl) !== 0) throw new Error('Previous schema upgrade failed');
  const preserved = await executeSql({ runtime: postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: 'p5_upgrade', sql: `SELECT (SELECT count(*) FROM organizations WHERE id='old_org'),(SELECT count(*) FROM teams WHERE id='old_team'),(SELECT count(*) FROM _prisma_migrations),(SELECT count(*) FROM pg_indexes WHERE indexname='teams_organizationId_code_key');` });
  if (preserved !== '1|1|3|1') throw new Error(`Upgrade did not preserve data/schema: ${preserved}`);
  const brokenRoot = path.join(temporaryRoot, 'broken-runtime'); await cp(fullRuntime, brokenRoot, { recursive: true }); const brokenMigration = path.join(brokenRoot, 'prisma/migrations/99999999999999_broken'); await mkdir(brokenMigration, { recursive: true }); await writeFile(path.join(brokenMigration, 'migration.sql'), 'THIS IS NOT SQL;');
  if (await migrate(brokenRoot, appUrl) === 0) throw new Error('Broken migration unexpectedly succeeded');
  if (await executeSql({ runtime: postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: 'pasko_performance', sql: 'SELECT count(*) FROM organizations;' }) !== '0') throw new Error('Migration failure changed operational data');
  console.log('Packaged Prisma embedded integration PASS: fresh migrate/bootstrap, empty product DB, idempotence, previous-schema upgrade/data preservation, broken migration fail-closed');
} finally { if (postgres) await postgres.stop().catch(() => undefined); await rm(temporaryRoot, { recursive: true, force: true }); }
