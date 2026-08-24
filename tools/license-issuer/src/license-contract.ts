import { createHash, createPrivateKey, createPublicKey, randomUUID, sign, verify } from 'node:crypto';

export const LICENSE_FORMAT_VERSION = 1 as const;
export const LICENSE_PRODUCT = 'PASKO_PERFORMANCE_PLATFORM' as const;
export const LICENSE_VERTICAL = 'VOLLEYBALL' as const;
export const MAX_LICENSE_BYTES = 64 * 1024;
export const LICENSE_PLANS = ['TRIAL', 'STANDARD', 'PRO', 'ENTERPRISE'] as const;
export const LICENSE_FEATURES = ['VOLLEYBALL_CORE', 'REFERENCE_PROFILES', 'BACKUP_RECOVERY', 'ADVANCED_ANALYTICS', 'EXPORT'] as const;
export type LicensePlan = typeof LICENSE_PLANS[number];
export type LicenseFeature = typeof LICENSE_FEATURES[number];
export interface LicensePayload { formatVersion: 1; licenseId: string; keyId: string; product: typeof LICENSE_PRODUCT; vertical: typeof LICENSE_VERTICAL; customerName: string; organizationName?: string; installationId: string; issuedAt: string; notBefore: string; expiresAt: string | null; plan: LicensePlan; maxDevices: number; features: LicenseFeature[]; issuer: 'PASKO'; signatureAlgorithm: 'Ed25519' }
export interface LicenseEnvelope { payload: LicensePayload; signature: string }

export function canonicalize(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object') { const record = value as Record<string, unknown>; return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`; }
  throw new Error('LICENSE_CANONICALIZATION_FAILED');
}
export function normalizeInstallationId(value: string): string { const normalized = value.trim().toLowerCase(); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) throw new Error('INVALID_INSTALLATION_ID'); return normalized; }
export function normalizeFeatures(values: readonly string[]): LicenseFeature[] { const selected = new Set(values); if (selected.size !== values.length || [...selected].some((value) => !LICENSE_FEATURES.includes(value as LicenseFeature))) throw new Error('INVALID_FEATURES'); return LICENSE_FEATURES.filter((feature) => selected.has(feature)); }
export function createPayload(input: { keyId: string; customerName: string; organizationName?: string; installationId: string; plan: LicensePlan; features: readonly string[]; maxDevices?: number; issuedAt?: Date; notBefore?: Date; expiresAt: Date | null }): LicensePayload {
  if (!LICENSE_PLANS.includes(input.plan)) throw new Error('INVALID_PLAN'); const customerName = input.customerName.trim(); if (!customerName) throw new Error('INVALID_CUSTOMER_NAME');
  const issuedAt = input.issuedAt ?? new Date(); const notBefore = input.notBefore ?? issuedAt; if (!Number.isFinite(issuedAt.getTime()) || !Number.isFinite(notBefore.getTime()) || (input.expiresAt && !Number.isFinite(input.expiresAt.getTime()))) throw new Error('INVALID_LICENSE_DATES');
  if (input.expiresAt && input.expiresAt.getTime() <= notBefore.getTime()) throw new Error('INVALID_LICENSE_DATES'); if (input.plan === 'TRIAL' && input.expiresAt === null) throw new Error('TRIAL_MUST_EXPIRE');
  const maxDevices = input.maxDevices ?? 1; if (!Number.isInteger(maxDevices) || maxDevices < 1) throw new Error('INVALID_MAX_DEVICES'); const organizationName = input.organizationName?.trim();
  return { formatVersion: LICENSE_FORMAT_VERSION, licenseId: randomUUID(), keyId: input.keyId, product: LICENSE_PRODUCT, vertical: LICENSE_VERTICAL, customerName, ...(organizationName ? { organizationName } : {}), installationId: normalizeInstallationId(input.installationId), issuedAt: issuedAt.toISOString(), notBefore: notBefore.toISOString(), expiresAt: input.expiresAt?.toISOString() ?? null, plan: input.plan, maxDevices, features: normalizeFeatures(input.features), issuer: 'PASKO', signatureAlgorithm: 'Ed25519' };
}
export function signPayload(payload: LicensePayload, encryptedPrivateKeyPem: string, passphrase: string): LicenseEnvelope { const privateKey = createPrivateKey({ key: encryptedPrivateKeyPem, format: 'pem', passphrase }); return { payload, signature: sign(null, Buffer.from(canonicalize(payload), 'utf8'), privateKey).toString('base64url') }; }
export function verifyEnvelope(envelope: LicenseEnvelope, publicKeyPem: string): boolean { try { return verify(null, Buffer.from(canonicalize(envelope.payload), 'utf8'), createPublicKey(publicKeyPem), Buffer.from(envelope.signature, 'base64url')); } catch { return false; } }
export function publicKeyFingerprint(publicKeyPem: string): string { return createHash('sha256').update(createPublicKey(publicKeyPem).export({ format: 'der', type: 'spki' })).digest('hex'); }
export function parseEnvelope(text: string): LicenseEnvelope { if (Buffer.byteLength(text, 'utf8') > MAX_LICENSE_BYTES) throw new Error('LICENSE_FILE_TOO_LARGE'); const parsed = JSON.parse(text) as LicenseEnvelope; if (!parsed?.payload || typeof parsed.signature !== 'string' || !/^[A-Za-z0-9_-]{64,128}$/.test(parsed.signature)) throw new Error('LICENSE_FILE_MALFORMED'); return parsed; }
