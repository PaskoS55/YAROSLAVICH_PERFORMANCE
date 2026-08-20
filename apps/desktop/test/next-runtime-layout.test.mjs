import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertSafeStagingPath,
  cleanStagingPath,
  createCopyPlan,
  findStandaloneServer,
  verifyPreparedRuntime,
} from '../scripts/next-runtime-layout.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pasko-performance-runtime-'));
  const standalone = path.join(root, 'standalone');
  const app = path.join(standalone, 'nested', 'web');
  await mkdir(app, { recursive: true });
  await writeFile(path.join(app, 'server.js'), '');
  await writeFile(path.join(app, 'package.json'), JSON.stringify({ name: '@pasko-performance/web' }));
  return { root, standalone, app };
}

test('finds the validated standalone server without assuming its nesting', async () => {
  const value = await fixture();
  assert.equal(await findStandaloneServer(value.standalone), path.join(value.app, 'server.js'));
});

test('fails clearly when server.js is absent', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pasko-performance-empty-'));
  await assert.rejects(findStandaloneServer(root), /found 0/);
});

test('creates public and static targets relative to the discovered server', async () => {
  const value = await fixture();
  const staging = path.join(value.root, 'runtime');
  const plan = createCopyPlan({ standaloneRoot: value.standalone, serverPath: path.join(value.app, 'server.js'), stagingRoot: staging, publicSource: 'public', staticSource: 'static' });
  assert.equal(plan.relativeServer, path.join('nested', 'web', 'server.js'));
  assert.equal(plan.publicTarget, path.join(staging, 'nested', 'web', 'public'));
  assert.equal(plan.staticTarget, path.join(staging, 'nested', 'web', '.next', 'static'));
});

test('cleans only a staging child and rejects paths outside its allowed root', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pasko-performance-clean-'));
  const allowed = path.join(root, '.runtime');
  const staging = path.join(allowed, 'web');
  const sentinel = path.join(root, 'keep.txt');
  await mkdir(staging, { recursive: true });
  await writeFile(sentinel, 'keep');
  assert.throws(() => assertSafeStagingPath(root, allowed), /Refusing/);
  await cleanStagingPath(staging, allowed);
  assert.equal(await readFile(sentinel, 'utf8'), 'keep');
});

test('runtime verification reports a missing required file', async () => {
  const value = await fixture();
  const plan = createCopyPlan({ standaloneRoot: value.standalone, serverPath: path.join(value.app, 'server.js'), stagingRoot: path.join(value.root, 'missing-runtime'), publicSource: 'public', staticSource: 'static' });
  await assert.rejects(verifyPreparedRuntime(plan), /Required prepared runtime path is missing/);
});
