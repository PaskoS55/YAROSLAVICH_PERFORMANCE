// TEST ONLY. Generates an ephemeral Ed25519 key and a license fixture for local automated tests.
// It never claims production identity and must not be included in packaged output.
import { generateKeyPairSync, sign } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { canonicalize } from '../dist/main/license.js';

const [installationId, licenseFile, publicKeyFile, state = 'valid', plan = 'PRO'] = process.argv.slice(2);
if (!installationId || !licenseFile || !publicKeyFile || !['TRIAL','STANDARD','PRO','ENTERPRISE'].includes(plan)) throw new Error('Usage: test-license-issuer <installationId> <licenseFile> <publicKeyFile> [valid|expired|wrong-installation] [TRIAL|STANDARD|PRO|ENTERPRISE]');
const pair = generateKeyPairSync('ed25519');
const now = new Date();
const payload = {
  formatVersion: 1, licenseId: `TEST-ONLY-${now.getTime()}`, keyId: 'TEST_ONLY_KEY', product: 'PASKO_PERFORMANCE_PLATFORM', vertical: 'VOLLEYBALL', customerName: 'TEST ONLY CLUB', organizationName: 'TEST ONLY CLUB', installationId: state === 'wrong-installation' ? '00000000-0000-4000-8000-000000000000' : installationId,
  issuedAt: new Date(now.getTime() - 86_400_000).toISOString(), notBefore: new Date(now.getTime() - 86_400_000).toISOString(), expiresAt: state === 'expired' ? new Date(now.getTime() - 3_600_000).toISOString() : new Date(now.getTime() + 86_400_000 * 30).toISOString(), plan, maxDevices: 1,
  features: ['VOLLEYBALL_CORE','REFERENCE_PROFILES','BACKUP_RECOVERY','ADVANCED_ANALYTICS','EXPORT'], issuer: 'PASKO', signatureAlgorithm: 'Ed25519',
};
const envelope = { payload, signature: sign(null, Buffer.from(canonicalize(payload)), pair.privateKey).toString('base64url') };
writeFileSync(licenseFile, `${JSON.stringify(envelope, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
writeFileSync(publicKeyFile, pair.publicKey.export({ type: 'spki', format: 'pem' }), { encoding: 'utf8', flag: 'wx' });
console.log('TEST ONLY license fixture created');
