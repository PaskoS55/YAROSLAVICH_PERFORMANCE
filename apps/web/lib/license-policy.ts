import { PRODUCT_IDENTITY } from '@pasko-performance/core/product';

// Build/product configuration only. Never read enforcement from process.env.
export const LICENSING_ENFORCEMENT = PRODUCT_IDENTITY.licensingEnforcement;
export type RuntimeLicenseState = 'UNLICENSED' | 'VALID' | 'EXPIRED' | 'INVALID' | 'WRONG_INSTALLATION' | 'NOT_YET_VALID' | 'CLOCK_ROLLBACK_SUSPECTED';

export function operationalLicenseAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return !LICENSING_ENFORCEMENT || getRuntimeLicenseState(env) === 'VALID';
}

export function getRuntimeLicenseState(env: NodeJS.ProcessEnv = process.env): RuntimeLicenseState {
  if ((env.NODE_ENV === 'development' || env.NODE_ENV === 'test') && env.APP_RUNTIME !== 'desktop' && env.PASKO_LICENSE_MODE === 'development') return 'VALID';
  const state = env.PASKO_LICENSE_STATE;
  return ['UNLICENSED','VALID','EXPIRED','INVALID','WRONG_INSTALLATION','NOT_YET_VALID','CLOCK_ROLLBACK_SUSPECTED'].includes(state ?? '') ? state as RuntimeLicenseState : 'UNLICENSED';
}

export function operationalLicenseRequired(env: NodeJS.ProcessEnv = process.env): void {
  if (!operationalLicenseAllowed(env)) throw new Error('LICENSE_RESTRICTED');
}

export function readLicenseMetadata(env: NodeJS.ProcessEnv = process.env): Record<string, string | null> | null {
  if (!env.PASKO_LICENSE_PAYLOAD) return null;
  try { return JSON.parse(Buffer.from(env.PASKO_LICENSE_PAYLOAD, 'base64url').toString('utf8')) as Record<string, string | null>; } catch { return null; }
}

export function trialDisplay(metadata: Record<string, string | null> | null, now = new Date()): { expiresAt: string; daysRemaining: number } | null {
  if (metadata?.plan !== 'TRIAL' || !metadata.expiresAt) return null;
  const expires = new Date(metadata.expiresAt); if (Number.isNaN(expires.getTime())) return null;
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const expiryUtc = Date.UTC(expires.getUTCFullYear(), expires.getUTCMonth(), expires.getUTCDate());
  return { expiresAt: expires.toLocaleDateString('ru-RU', { timeZone: 'UTC' }), daysRemaining: Math.max(0, Math.ceil((expiryUtc - todayUtc) / 86_400_000)) };
}
