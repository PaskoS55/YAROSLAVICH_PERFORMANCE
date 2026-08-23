import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scryptSync } from 'node:crypto';
import {
  createInternalSnapshot,
  determineMigrationState,
  listSnapshotManifests,
  redactSensitiveText,
  resolveRecoveryPaths,
  validateInternalSnapshot,
  writeRecoveryStatus,
  appendRedactedRuntimeLog,
  assertDisposableTestTarget,
  verifyLocalPasswordHash,
  writeDisposableTestMarker,
} from '../dist/main/recovery.js';
import { parseAppliedMigrationRows } from '../dist/main/packaged-database.js';

const migrationNames = ['001_init', '002_next'];
const installationId = 'installation-test';
const snapshotIds = [1, 2, 3, 4, 5, 6].map((n) => `00000000-0000-4000-8000-00000000000${n}`);

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pasko-recovery-unit-'));
  const paths = resolveRecoveryPaths(root);
  const postgresPaths = { bin: { pg_dump: 'pg_dump.exe', pg_restore: 'pg_restore.exe' } };
  const postgres = { port: 54321, paths: postgresPaths };
  const migrationState = determineMigrationState(migrationNames, [{ name: '001_init', finished: true, rolledBack: false }], true);
  const runner = async ({ executable, args }) => {
    if (executable === 'pg_dump.exe') writeFileSync(args.at(-1), Buffer.alloc(2048, 7));
    return { stdout: executable === 'pg_restore.exe' ? 'TABLE public.organizations' : '' };
  };
  return { root, paths, postgresPaths, postgres, migrationState, runner, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('detects fresh, current, pending, multiple pending and failed migrations by name', () => {
  assert.deepEqual(determineMigrationState(migrationNames, [], false).pending, migrationNames);
  assert.equal(determineMigrationState(migrationNames, [], false).fresh, true);
  assert.deepEqual(determineMigrationState(migrationNames, migrationNames.map((name) => ({ name, finished: true, rolledBack: false })), true).pending, []);
  assert.deepEqual(determineMigrationState(migrationNames, [{ name: '001_init', finished: true, rolledBack: false }], true).pending, ['002_next']);
  assert.deepEqual(determineMigrationState(['001', '002', '003'], [{ name: '001', finished: true, rolledBack: false }], true).pending, ['002', '003']);
  assert.deepEqual(determineMigrationState(migrationNames, [{ name: '002_next', finished: false, rolledBack: false }], true).failed, ['002_next']);
  assert.deepEqual(parseAppliedMigrationRows('001_init|t|f\n002_next|f|f'), [{ name: '001_init', finished: true, rolledBack: false }, { name: '002_next', finished: false, rolledBack: false }]);
});

test('creates an atomic verified manifest only after pg_restore inspection', async () => {
  const f = fixture();
  try {
    const manifest = await createInternalSnapshot({ paths: f.paths, postgres: f.postgres, password: 'not-logged', installationId, productVersion: '1.0.0', migrationState: f.migrationState, databaseSize: 1, reason: 'PRE_MIGRATION', runner: f.runner, snapshotId: snapshotIds[0], now: new Date('2026-08-23T20:00:00Z') });
    assert.equal(manifest.sizeBytes, 2048);
    assert.equal(readFileSync(path.join(f.paths.manifests, `${snapshotIds[0]}.json`), 'utf8').includes('not-logged'), false);
    assert.deepEqual(readdirSync(f.paths.snapshots), [`${snapshotIds[0]}.dump`]);
    assert.deepEqual(readdirSync(f.paths.manifests), [`${snapshotIds[0]}.json`]);
  } finally { f.cleanup(); }
});

test('pg_dump and verification failure publish no snapshot or manifest', async () => {
  for (const failure of ['dump', 'verify']) {
    const f = fixture();
    try {
      const runner = async ({ executable, args }) => {
        if (executable === 'pg_dump.exe') {
          if (failure === 'dump') throw new Error('dump failed');
          writeFileSync(args.at(-1), Buffer.alloc(2048, 1));
        } else if (failure === 'verify') throw new Error('verify failed');
        return { stdout: '' };
      };
      await assert.rejects(createInternalSnapshot({ paths: f.paths, postgres: f.postgres, password: 'x', installationId, productVersion: '1', migrationState: f.migrationState, databaseSize: 1, reason: 'PRE_MIGRATION', runner, snapshotId: snapshotIds[0] }));
      assert.deepEqual(readdirSync(f.paths.snapshots), []);
      assert.deepEqual(readdirSync(f.paths.manifests), []);
    } finally { f.cleanup(); }
  }
});

test('refuses snapshot when conservative disk requirement cannot fit', async () => {
  const f = fixture();
  try {
    await assert.rejects(createInternalSnapshot({ paths: f.paths, postgres: f.postgres, password: 'x', installationId, productVersion: '1', migrationState: f.migrationState, databaseSize: Number.MAX_SAFE_INTEGER, reason: 'PRE_MIGRATION', runner: f.runner }), /DISK_SPACE/);
  } finally { f.cleanup(); }
});

test('retains latest five snapshots only after successful creation', async () => {
  const f = fixture();
  try {
    for (let index = 0; index < 6; index += 1) await createInternalSnapshot({ paths: f.paths, postgres: f.postgres, password: 'x', installationId, productVersion: '1', migrationState: f.migrationState, databaseSize: 1, reason: 'PRE_MIGRATION', runner: f.runner, snapshotId: snapshotIds[index], now: new Date(Date.UTC(2026, 7, 23, 20, index)) });
    const manifests = listSnapshotManifests(f.paths);
    assert.equal(manifests.length, 5);
    assert.equal(manifests.some((item) => item.snapshotId === snapshotIds[0]), false);
  } finally { f.cleanup(); }
});

test('rejects checksum tamper, manifest tamper and another installation', async () => {
  const f = fixture();
  try {
    const manifest = await createInternalSnapshot({ paths: f.paths, postgres: f.postgres, password: 'x', installationId, productVersion: '1', migrationState: f.migrationState, databaseSize: 1, reason: 'PRE_MIGRATION', runner: f.runner, snapshotId: snapshotIds[0] });
    await assert.rejects(validateInternalSnapshot({ paths: f.paths, manifest, installationId: 'other', postgresPaths: f.postgresPaths, password: 'x', runner: f.runner }), /INSTALLATION_MISMATCH/);
    await assert.rejects(validateInternalSnapshot({ paths: f.paths, manifest: { ...manifest, postgresMajor: '15' }, installationId, postgresPaths: f.postgresPaths, password: 'x', runner: f.runner }), /POSTGRES_VERSION/);
    writeFileSync(path.join(f.paths.snapshots, `${snapshotIds[0]}.dump`), Buffer.alloc(2048, 9));
    await assert.rejects(validateInternalSnapshot({ paths: f.paths, manifest, installationId, postgresPaths: f.postgresPaths, password: 'x', runner: f.runner }), /CHECKSUM/);
  } finally { f.cleanup(); }
});

test('tracks repeated recovery state without creating snapshot loops', () => {
  const f = fixture();
  try {
    const value = { state: 'MIGRATION_FAILED', occurredAt: '2026-08-23T20:00:00Z', snapshotId: snapshotIds[0], publicMessage: 'safe', technicalCode: 'MIGRATE' };
    assert.equal(writeRecoveryStatus(f.paths, value).attempts, 1);
    assert.equal(writeRecoveryStatus(f.paths, value).attempts, 2);
  } finally { f.cleanup(); }
});

test('redacts URLs, authorization, cookies and all secret classes', () => {
  const input = 'postgresql://user:dbpass@127.0.0.1/db Authorization: Bearer token Cookie: session=abc password=p recoveryKey:k databasePassword=d authSessionSecret=s installationSecret=i';
  const output = redactSensitiveText(input);
  for (const secret of ['dbpass', 'token', 'session=abc', 'password=p', 'recoveryKey:k', 'databasePassword=d', 'authSessionSecret=s', 'installationSecret=i']) assert.equal(output.includes(secret), false);
});

test('bounds persistent runtime logs and redacts before writing', () => {
  const f = fixture();
  try {
    for (let index = 0; index < 8; index += 1) appendRedactedRuntimeLog(f.root, `password=secret-${index}`, 3, 1);
    const logs = readdirSync(f.root).filter((name) => name.endsWith('.log'));
    assert.ok(logs.length <= 3);
    for (const name of logs) assert.equal(readFileSync(path.join(f.root, name), 'utf8').includes('secret-'), false);
  } finally { f.cleanup(); }
});

test('requires a matching marker for destructive disposable targets and rejects outside paths', () => {
  const root = path.join('C:\\Temp', `pasko_phase7_${Date.now()}`);
  const marker = writeDisposableTestMarker(root, 'unit-test-run-1234');
  try {
    assert.equal(assertDisposableTestTarget(root, marker), path.resolve(root));
    assert.throws(() => assertDisposableTestTarget('C:\\Projects\\YAROSLAVICH_APP', marker), /TARGET_REJECTED/);
    assert.throws(() => assertDisposableTestTarget(path.join('C:\\Temp', 'pasko_phase7_forged'), marker), /TARGET_REJECTED/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('verifies the existing LocalUser scrypt format for recovery authorization', async () => {
  const salt = Buffer.alloc(16, 3);
  const key = scryptSync('correct password', salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const encoded = `scrypt$v1$N=32768,r=8,p=1$${salt.toString('base64url')}$${key.toString('base64url')}`;
  assert.equal(await verifyLocalPasswordHash('correct password', encoded), true);
  assert.equal(await verifyLocalPasswordHash('wrong password', encoded), false);
});
