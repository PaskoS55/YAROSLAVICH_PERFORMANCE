import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildNextRuntimeEnv, getSafeRuntimeEnvLog, redactRuntimeText } from '../dist/main/runtime-env.js';
import { createIdempotentStopper } from '../dist/main/runtime-lifecycle.js';
import { resolveRuntimeTarget } from '../dist/main/runtime-paths.js';
import { findAvailableLoopbackPort } from '../dist/main/runtime-port.js';
import { waitForNextReadiness } from '../dist/main/runtime-readiness.js';
import { classifyNavigation } from '../dist/main/url-policy.js';

test('resolves development and manifest-driven packaged runtime paths', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pasko-performance-packaged-'));
  const web = path.join(root, 'web');
  const server = path.join(web, 'nested', 'server.js');
  await mkdir(path.dirname(server), { recursive: true });
  await writeFile(server, '');
  await writeFile(path.join(web, 'runtime-manifest.json'), JSON.stringify({ server: path.join('nested', 'server.js') }));
  const development = resolveRuntimeTarget({ isPackaged: false, resourcesPath: root, developmentUrl: 'http://127.0.0.1:3456' });
  assert.equal(development.kind, 'development');
  assert.equal(development.url.origin, 'http://127.0.0.1:3456');
  const packaged = resolveRuntimeTarget({ isPackaged: true, resourcesPath: root });
  assert.equal(packaged.kind, 'packaged');
  assert.equal(packaged.serverPath, server);
});

test('chooses a dynamic loopback port and enforces its exact origin', async () => {
  const port = await findAvailableLoopbackPort();
  assert.ok(port > 0);
  const origin = new URL(`http://127.0.0.1:${port}`);
  assert.equal(classifyNavigation(`${origin.origin}/players`, origin), 'internal');
  assert.equal(classifyNavigation(`http://127.0.0.1:${port + 1}/players`, origin), 'blocked');
});

test('builds a minimal child environment and redacts all secrets from logs', () => {
  const env = buildNextRuntimeEnv({ DATABASE_URL: 'db-secret', AUTH_PASSWORD: 'auth-secret', AUTH_SESSION_SECRET: 'session-secret', PATH: 'must-not-pass', SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows' }, 43210);
  assert.deepEqual(Object.keys(env).sort(), ['APP_RUNTIME', 'AUTH_PASSWORD', 'AUTH_SESSION_SECRET', 'DATABASE_URL', 'HOSTNAME', 'NODE_ENV', 'PORT', 'SystemRoot', 'WINDIR'].sort());
  assert.deepEqual(getSafeRuntimeEnvLog(env), { NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: '43210', APP_RUNTIME: 'desktop' });
  assert.equal(redactRuntimeText('auth-secret session-secret db-secret', env), '[REDACTED] [REDACTED] [REDACTED]');
});

test('readiness detects premature child exit', async () => {
  await assert.rejects(waitForNextReadiness({ url: 'http://127.0.0.1:1/login', timeoutMs: 100, intervalMs: 1, hasExited: () => true }), /exited before readiness/);
});

test('readiness times out instead of waiting forever', async () => {
  await assert.rejects(waitForNextReadiness({
    url: 'http://127.0.0.1:1/login', timeoutMs: 5, intervalMs: 1, hasExited: () => false,
    fetchImpl: async () => { throw new Error('not ready'); },
  }), /timed out/);
});

test('runtime shutdown is idempotent', () => {
  let kills = 0;
  const stop = createIdempotentStopper(() => ({ kill: () => { kills += 1; return true; } }));
  assert.equal(stop(), true);
  assert.equal(stop(), false);
  assert.equal(kills, 1);
});
