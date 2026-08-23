import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { canonicalize, evaluateLicense, LicenseStore, MAX_LICENSE_BYTES, parseLicenseEnvelope } from '../dist/main/license.js';

const pair = generateKeyPairSync('ed25519');
const keyId = 'TEST_ONLY_KEY';
const publicKeys = { [keyId]: pair.publicKey.export({ type: 'spki', format: 'pem' }) };
const installationId = '11111111-1111-4111-8111-111111111111';
const now = new Date('2026-08-24T12:00:00.000Z');
function payload(overrides = {}) { return { formatVersion: 1, licenseId: 'test-license-001', keyId, product: 'PASKO_PERFORMANCE_PLATFORM', vertical: 'VOLLEYBALL', customerName: 'TEST ONLY CLUB', organizationName: 'TEST ONLY', installationId, issuedAt: '2026-08-20T00:00:00.000Z', notBefore: '2026-08-20T00:00:00.000Z', expiresAt: '2027-08-20T00:00:00.000Z', plan: 'PRO', maxDevices: 1, features: ['VOLLEYBALL_CORE','REFERENCE_PROFILES','BACKUP_RECOVERY','ADVANCED_ANALYTICS','EXPORT'], issuer: 'PASKO', signatureAlgorithm: 'Ed25519', ...overrides }; }
function envelope(overrides = {}) { const value = payload(overrides); return { payload: value, signature: sign(null, Buffer.from(canonicalize(value)), pair.privateKey).toString('base64url') }; }
function evaluation(overrides = {}, extra = {}) { return evaluateLicense({ envelope: envelope(overrides), installationId, publicKeys, now, ...extra }); }
const safeStorage = { isEncryptionAvailable: () => true, encryptString: (value) => Buffer.from(value), decryptString: (value) => value.toString('utf8') };

test('verifies valid, perpetual, expired and not-before licenses offline', () => {
  assert.equal(evaluation().state, 'VALID');
  assert.equal(evaluation({ expiresAt: null }).state, 'VALID');
  assert.equal(evaluation({ expiresAt: '2026-08-23T00:00:00.000Z' }).state, 'EXPIRED');
  assert.equal(evaluation({ notBefore: '2026-08-25T00:00:00.000Z' }).state, 'NOT_YET_VALID');
});
test('rejects signature, payload and claim tampering', () => {
  const signed = envelope(); signed.payload.plan = 'TRIAL';
  assert.equal(evaluateLicense({ envelope: signed, installationId, publicKeys, now }).state, 'INVALID');
  const signature = envelope(); signature.signature = `${signature.signature.slice(0,-1)}A`;
  assert.equal(evaluateLicense({ envelope: signature, installationId, publicKeys, now }).state, 'INVALID');
  assert.equal(evaluation({ product: 'OTHER' }).state, 'INVALID');
  assert.equal(evaluation({ vertical: 'OTHER' }).state, 'INVALID');
  assert.equal(evaluation({ keyId: 'UNKNOWN' }).state, 'INVALID');
});
test('enforces Installation ID and detects meaningful UTC clock rollback', () => {
  assert.equal(evaluation({ installationId: 'another-installation' }).state, 'WRONG_INSTALLATION');
  assert.equal(evaluation({}, { lastKnownValidTime: '2026-08-26T12:00:00.000Z' }).state, 'CLOCK_ROLLBACK_SUSPECTED');
  assert.equal(evaluation({}, { lastKnownValidTime: '2026-08-24T18:00:00.000Z' }).state, 'VALID');
});
test('rejects malformed and oversized license files', () => {
  assert.throws(() => parseLicenseEnvelope('{bad'), SyntaxError);
  assert.throws(() => parseLicenseEnvelope('x'.repeat(MAX_LICENSE_BYTES + 1)), /TOO_LARGE/);
});
test('atomically persists activation and invalid replacement preserves valid license', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pasko-license-test-'));
  try {
    const store = new LicenseStore(root, safeStorage, publicKeys);
    assert.equal(store.evaluate(installationId, now).state, 'UNLICENSED');
    assert.equal(store.activate(JSON.stringify(envelope()), installationId, now).state, 'VALID');
    const original = readFileSync(store.licensePath, 'utf8');
    const wrong = envelope({ installationId: 'copied-installation' });
    assert.equal(store.activate(JSON.stringify(wrong), installationId, now).state, 'WRONG_INSTALLATION');
    assert.equal(readFileSync(store.licensePath, 'utf8'), original);
    assert.equal(store.evaluate(installationId, new Date('2026-08-25T00:00:00.000Z')).state, 'VALID');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('packaging excludes the test issuer and test sources', () => {
  const forge = createRequire(import.meta.url)('../forge.config.cjs');
  assert.ok(forge.packagerConfig.ignore.some((pattern) => pattern.test('/scripts/test-license-issuer.mjs')));
  assert.ok(forge.packagerConfig.ignore.some((pattern) => pattern.test('/test/license.test.mjs')));
});
