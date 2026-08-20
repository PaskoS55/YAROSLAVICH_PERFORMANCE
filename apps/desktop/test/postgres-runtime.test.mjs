import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { assertChecksum, assertSafePostgresStagingPath, validatePostgresManifest } from '../scripts/postgres-runtime-layout.mjs';
import { buildInitDbCommand, buildLocalDatabaseUrl, buildPgCtlStartCommand, buildPgCtlStopCommand, detectClusterState, detectLegacyDataRoot, redactDatabaseText, resolvePostgresPaths } from '../dist/main/postgres.js';
import { loadProductIdentity, resolveProductIdentityPath } from '../dist/main/product-identity.js';

test('validates the pinned PostgreSQL runtime manifest', () => {
  const manifest = { version: '16.14', major: 16, platform: 'win32', arch: 'x64', archive: 'postgresql-16.14-2-windows-x64-binaries.zip', url: 'https://get.enterprisedb.com/postgresql/postgresql-16.14-2-windows-x64-binaries.zip', sha256: 'a'.repeat(64) };
  assert.equal(validatePostgresManifest(manifest), manifest);
  assert.throws(() => validatePostgresManifest({ ...manifest, major: 17 }));
});

test('validates checksums and safe staging cleanup boundaries', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pasko-performance-pg-layout-')); const file = path.join(root, 'archive.zip'); await writeFile(file, 'trusted');
  await assertChecksum(file, 'a9a089195c68d2adeee23beaa2c3a93b1d4cdf09046e7a9e520b3b166dff3e6a');
  await assert.rejects(assertChecksum(file, '0'.repeat(64)), /checksum mismatch/);
  assert.equal(assertSafePostgresStagingPath(path.join(root, 'child'), root), path.join(root, 'child'));
  assert.throws(() => assertSafePostgresStagingPath(root, root));
});

test('resolves packaged binaries and persistent user data paths', () => {
  const paths = resolvePostgresPaths({ resourcesPath: 'C:\\app\\resources', localAppData: 'C:\\Users\\user\\AppData\\Local' });
  assert.equal(paths.bin.pg_ctl, path.resolve('C:\\app\\resources', 'postgres', 'bin', 'pg_ctl.exe'));
  assert.equal(paths.dataDirectory, path.resolve('C:\\Users\\user\\AppData\\Local', 'PaskoPerformance', 'database', 'pg16'));
});

test('detects absent, valid, and invalid clusters without deleting data', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pasko-performance-pg-state-')); const missing = path.join(root, 'missing');
  assert.equal(detectClusterState(missing), 'absent'); await mkdir(missing); assert.equal(detectClusterState(missing), 'invalid');
  await writeFile(path.join(missing, 'PG_VERSION'), '16\n'); await mkdir(path.join(missing, 'global')); await writeFile(path.join(missing, 'global', 'pg_control'), 'x'); assert.equal(detectClusterState(missing), 'valid');
});

test('uses canonical product identity and detects legacy data without modifying it', async () => {
  const identity = loadProductIdentity({ isPackaged: false, resourcesPath: 'unused' });
  assert.equal(identity.canonical, 'PASKO PERFORMANCE PLATFORM');
  assert.equal(identity.databaseName, 'pasko_performance');
  assert.match(resolveProductIdentityPath({ isPackaged: true, resourcesPath: 'R:\\resources' }), /product-identity\.json$/);
  const root = await mkdtemp(path.join(os.tmpdir(), 'pasko-performance-legacy-'));
  assert.equal(detectLegacyDataRoot(root), null);
  const legacy = path.join(root, 'YaroslavichPerformance'); await mkdir(legacy); await writeFile(path.join(legacy, 'marker'), 'untouched');
  assert.equal(detectLegacyDataRoot(root), legacy);
  assert.equal(await (await import('node:fs/promises')).readFile(path.join(legacy, 'marker'), 'utf8'), 'untouched');
});

test('keeps package and Windows runtime naming product-level', () => {
  const require = createRequire(import.meta.url);
  const desktopPackage = require('../package.json');
  const forge = require('../forge.config.cjs');
  assert.equal(desktopPackage.name, '@pasko-performance/desktop');
  assert.equal(forge.packagerConfig.executableName, 'PaskoPerformance');
  assert.equal(forge.packagerConfig.appBundleId, 'com.pasko.performance');
  assert.equal(forge.makers[0].config.name, 'pasko_performance');
});

test('builds safe init, start and fast shutdown commands', () => {
  const paths = resolvePostgresPaths({ resourcesPath: 'R:\\resources', localAppData: 'D:\\data' });
  const init = buildInitDbCommand(paths, 'D:\\private\\pw'); assert.ok(init.args.includes('--auth-host=scram-sha-256')); assert.ok(init.args.includes('--data-checksums')); assert.ok(!init.args.join(' ').includes('secret'));
  assert.deepEqual(buildPgCtlStopCommand(paths).args.slice(0, 4), ['stop', '-D', paths.dataDirectory, '-m']);
  assert.match(buildPgCtlStartCommand(paths, 43210, 'D:\\log').args.at(-1), /127\.0\.0\.1 -p 43210/);
});

test('encodes database URLs and redacts credentials', () => {
  const url = buildLocalDatabaseUrl({ host: '127.0.0.1', port: 4567, database: 'db/name', username: 'user@local', password: 'p:a/ss' });
  assert.equal(url, 'postgresql://user%40local:p%3Aa%2Fss@127.0.0.1:4567/db%2Fname');
  assert.equal(redactDatabaseText(url), 'postgresql://[REDACTED]@127.0.0.1:4567/db%2Fname');
});
