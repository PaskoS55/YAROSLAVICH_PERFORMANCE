// Disposable synthetic fixtures only; no .env or production signing material is read.
import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, createHmac, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { InstallationSecurityStore } from '../dist/main/installation-security.js';
import { canonicalize, LicenseStore } from '../dist/main/license.js';
import { startPackagedDatabase } from '../dist/main/packaged-database.js';
import { APPLICATION_USER, DEFAULT_DATABASE, DEMO_DATABASE, executeSql } from '../dist/main/postgres.js';
import { buildNextRuntimeEnv } from '../dist/main/runtime-env.js';
import { resolvePackagedRuntime } from '../dist/main/runtime-paths.js';

const repo = path.resolve(import.meta.dirname, '../../..');
const product = JSON.parse(await readFile(path.join(repo, 'packages/core/product-identity.json'), 'utf8'));
assert.equal(product.licensingEnforcement, false);
const resourcesPath = path.join(repo, 'apps/desktop/.runtime');
const runtime = resolvePackagedRuntime(resourcesPath);
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'pasko-licensing-freeze-'));
// Test adapter only: encrypted fixtures with a random process-local key, never persisted.
const storageKey = randomBytes(32);
const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString(value) { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', storageKey, iv); const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), body]); },
  decryptString(value) { const cipher = createDecipheriv('aes-256-gcm', storageKey, value.subarray(0, 12)); cipher.setAuthTag(value.subarray(12, 28)); return Buffer.concat([cipher.update(value.subarray(28)), cipher.final()]).toString('utf8'); },
};
let database;
let server;
async function stopServer() {
  if (!server) return;
  const child = server; server = undefined;
  if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
}
async function freePort() {
  const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise((resolve) => socket.close(resolve)); return port;
}
async function startServer(source, databaseUrl) {
  await stopServer();
  const port = await freePort(); const origin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [runtime.serverPath], { cwd: path.dirname(runtime.serverPath), windowsHide: true, env: buildNextRuntimeEnv(source, port, databaseUrl), stdio: 'ignore' });
  server.on('error', () => {});
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error('Synthetic standalone exited before readiness');
    try { await fetch(`${origin}/login`, { redirect: 'manual', signal: AbortSignal.timeout(2000) }); return origin; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); }
  }
  throw new Error('Synthetic standalone readiness timeout');
}
async function page(origin, route, expected, cookie) {
  const response = await fetch(`${origin}${route}`, { headers: cookie ? { cookie } : {}, signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `${route}: HTTP ${response.status}`);
  assert.equal(new URL(response.url).pathname, expected, `${route}: unexpected redirect`);
  await response.arrayBuffer();
}
function token(secret, demo = false) {
  const now = Date.now();
  const payload = Buffer.from(JSON.stringify({ version: 1, userId: 'freeze-admin', issuedAt: now, expiresAt: now + 600000, ...(demo ? { scope: 'demo' } : {}) })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(`${demo ? 'PASKO_DEMO_CAPABILITY_V1' : 'PASKO_AUTH_SESSION_V1'}\0${payload}`).digest('hex')}`;
}
try {
  const security = new InstallationSecurityStore(temporaryRoot, safeStorage).create();
  const credentials = { bootstrapPassword: security.secrets.databaseBootstrapPassword, applicationPassword: security.secrets.databasePassword };
  const source = { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, AUTH_SESSION_SECRET: security.secrets.authSessionSecret, PASKO_INSTALLATION_ID: security.installationId, PASKO_PRODUCT_VERSION: '1.0.0', PASKO_LICENSE_STATE: 'UNLICENSED' };
  const pair = generateKeyPairSync('ed25519');
  const license = new LicenseStore(temporaryRoot, safeStorage, { TEST_ONLY_KEY: pair.publicKey.export({ type: 'spki', format: 'pem' }) });
  const now = new Date('2026-08-24T12:00:00.000Z');
  function signedLicense(expiresAt) {
    const payload = { formatVersion: 1, licenseId: 'synthetic-freeze-test', keyId: 'TEST_ONLY_KEY', product: 'PASKO_PERFORMANCE_PLATFORM', vertical: 'VOLLEYBALL', customerName: 'SYNTHETIC TEST', organizationName: 'SYNTHETIC TEST', installationId: security.installationId, issuedAt: '2026-08-20T00:00:00.000Z', notBefore: '2026-08-20T00:00:00.000Z', expiresAt, plan: 'PRO', maxDevices: 1, features: ['VOLLEYBALL_CORE', 'REFERENCE_PROFILES', 'BACKUP_RECOVERY', 'ADVANCED_ANALYTICS', 'EXPORT'], issuer: 'PASKO', signatureAlgorithm: 'Ed25519' };
    return JSON.stringify({ payload, signature: sign(null, Buffer.from(canonicalize(payload)), pair.privateKey).toString('base64url') });
  }
  assert.equal(license.evaluate(security.installationId, now).state, 'UNLICENSED');
  database = await startPackagedDatabase({ resourcesPath, localAppData: temporaryRoot, dataRoot: temporaryRoot, source, credentialsProvider: { getCredentials: async () => credentials }, licensingEnforcement: product.licensingEnforcement });
  assert.ok(database.demoDatabaseUrl, 'Demo must initialize without a license');
  const sql = (text, name = DEFAULT_DATABASE) => executeSql({ runtime: database.postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: name, sql: text });
  for (const state of ['UNLICENSED', 'INVALID']) {
    if (state === 'INVALID') { await mkdir(path.dirname(license.licensePath), { recursive: true }); await writeFile(license.licensePath, '{malformed'); }
    assert.equal(license.evaluate(security.installationId, now).state, state);
    const origin = await startServer({ ...source, PASKO_LICENSE_STATE: state }, database.databaseUrl);
    for (const route of ['/', '/login', '/license', '/license?replace=1']) await page(origin, route, '/setup');
    console.log(`Clean installation ${state}: First Run PASS`);
  }
  await stopServer();
  await rm(license.licensePath);
  const admin = `INSERT INTO local_users(id,"displayName",login,login_normalized,password_hash,recovery_key_hash,created_at,updated_at) VALUES ('freeze-admin','Synthetic Admin','freeze-admin','freeze-admin','test-only-not-a-login-password','test-only',now(),now());`;
  await sql(admin); await sql(admin, DEMO_DATABASE);
  await sql(`INSERT INTO organizations(id,name,code,"updatedAt") VALUES ('freeze-org','Synthetic Club','FREEZE',now());
    INSERT INTO teams(id,name,code,"organizationId","updatedAt") VALUES ('freeze-team','Synthetic Team','FREEZE','freeze-org',now());
    INSERT INTO seasons(id,name,"startDate","endDate","updatedAt") VALUES ('freeze-season','Synthetic Season','2026-01-01','2027-01-01',now());
    INSERT INTO "_SeasonToTeam"("A","B") VALUES ('freeze-season','freeze-team');`);
  const cookie = `yp_auth=${token(source.AUTH_SESSION_SECRET)}`;
  for (const state of ['UNLICENSED', 'EXPIRED', 'VALID']) {
    if (state !== 'UNLICENSED') await writeFile(license.licensePath, signedLicense(state === 'EXPIRED' ? '2026-08-23T00:00:00.000Z' : '2027-08-23T00:00:00.000Z'));
    const result = license.evaluate(security.installationId, now); assert.equal(result.state, state);
    const origin = await startServer({ ...source, PASKO_LICENSE_STATE: result.state, PASKO_LICENSE_PAYLOAD: JSON.stringify(result.payload ?? {}) }, database.databaseUrl);
    for (const route of ['/', '/license', '/license?replace=1', '/players']) await page(origin, route, '/login');
    await page(origin, '/players', '/login', 'yp_auth=forged');
    for (const route of ['/', '/settings', '/players', '/norms', '/analytics', '/compare', '/goals', '/body', '/api/backup', '/api/export?type=team']) await page(origin, route, route.split('?')[0], cookie);
    console.log(`Existing installation ${state}: Login, all feature pages, backup/export, forged session rejection PASS`);
  }
  const demoOrigin = await startServer({ ...source, PASKO_WORKSPACE: 'demo', PASKO_LICENSE_STATE: 'UNLICENSED' }, database.demoDatabaseUrl);
  const demoCookie = `${cookie}; pasko_demo_capability=${token(source.AUTH_SESSION_SECRET, true)}`;
  for (const route of ['/', '/players', '/norms', '/analytics', '/compare', '/goals', '/settings']) await page(demoOrigin, route, route, demoCookie);
  const blocked = await fetch(`${demoOrigin}/api/backup`, { headers: { cookie: demoCookie } }); assert.equal(blocked.status, 403);
  assert.equal(await sql('SELECT count(*) FROM players', DEMO_DATABASE), '14');
  assert.equal(await sql('SELECT count(*) FROM players'), '0');
  assert.equal(new InstallationSecurityStore(temporaryRoot, safeStorage).load().installationId, security.installationId);
  console.log('Demo without license, feature pages, Demo restrictions, club isolation and Installation ID persistence: PASS');
  console.log('LICENSING FREEZE INTEGRATION: PASS');
} finally {
  await stopServer();
  if (database) await database.stop();
  // Only the exact disposable root created by mkdtemp above may be removed.
  assert.equal(path.dirname(temporaryRoot), path.resolve(os.tmpdir()));
  assert.ok(path.basename(temporaryRoot).startsWith('pasko-licensing-freeze-'));
  await rm(temporaryRoot, { recursive: true, force: true });
}
