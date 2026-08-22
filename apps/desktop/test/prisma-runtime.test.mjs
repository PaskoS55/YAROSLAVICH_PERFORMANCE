import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PhaseFiveCredentialsProvider } from '../dist/main/database-credentials.js';
import { buildMigrateDeployArgs, buildPrismaUtilityEnv, PACKAGED_PRISMA_VERSION, resolvePrismaRuntime, verifyPrismaRuntime } from '../dist/main/prisma-runtime-paths.js';

async function fakeRuntime() {
  const resources = await mkdtemp(path.join(os.tmpdir(), 'pasko-prisma-runtime-'));
  const paths = resolvePrismaRuntime(resources);
  for (const file of [paths.cli, paths.schemaEngine, paths.queryEngine, paths.client, paths.schema, paths.bootstrap]) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, 'x'); }
  await mkdir(path.join(paths.migrations, '001_initial'), { recursive: true });
  await writeFile(path.join(paths.migrations, 'migration_lock.toml'), 'provider = "postgresql"');
  await writeFile(path.join(paths.migrations, '001_initial', 'migration.sql'), 'SELECT 1;');
  await mkdir(path.join(paths.root, 'node_modules/prisma'), { recursive: true });
  await writeFile(path.join(paths.root, 'node_modules/prisma/package.json'), JSON.stringify({ version: PACKAGED_PRISMA_VERSION }));
  return paths;
}

test('derives stable separated database credentials without storing plaintext', async () => {
  const provider = new PhaseFiveCredentialsProvider({ AUTH_SESSION_SECRET: 'synthetic-test-secret-with-sufficient-length' });
  const first = await provider.getCredentials(); const second = await provider.getCredentials();
  assert.deepEqual(first, second); assert.notEqual(first.bootstrapPassword, first.applicationPassword); assert.ok(!JSON.stringify(first).includes('synthetic-test-secret'));
});

test('fails closed when the credential source is absent', async () => {
  await assert.rejects(new PhaseFiveCredentialsProvider({}).getCredentials(), /unavailable/);
});

test('resolves and verifies an immutable Prisma 5.22.0 runtime', async () => {
  const paths = await fakeRuntime(); assert.doesNotThrow(() => verifyPrismaRuntime(paths)); assert.equal(PACKAGED_PRISMA_VERSION, '5.22.0');
});

test('rejects incomplete migration history', async () => {
  const paths = await fakeRuntime(); await writeFile(path.join(paths.root, 'node_modules/prisma/package.json'), JSON.stringify({ version: '7.0.0' }));
  assert.throws(() => verifyPrismaRuntime(paths), /Unsupported packaged Prisma version/);
});

test('constructs migrate deploy only', async () => {
  const paths = await fakeRuntime(); assert.deepEqual(buildMigrateDeployArgs(paths), ['migrate', 'deploy', '--schema', paths.schema]);
});

test('constructs a controlled Prisma environment without PATH', async () => {
  const paths = await fakeRuntime();
  const env = buildPrismaUtilityEnv({ databaseUrl: 'postgresql://user:secret@127.0.0.1:5432/db', paths, source: { PATH: 'forbidden', SystemRoot: 'C:\\Windows' } });
  assert.equal(env.PATH, undefined); assert.equal(env.PRISMA_SCHEMA_ENGINE_BINARY, paths.schemaEngine); assert.equal(env.PRISMA_QUERY_ENGINE_LIBRARY, paths.queryEngine);
});
