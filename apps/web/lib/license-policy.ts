export type RuntimeLicenseState = 'UNLICENSED' | 'VALID' | 'EXPIRED' | 'INVALID' | 'WRONG_INSTALLATION' | 'NOT_YET_VALID' | 'CLOCK_ROLLBACK_SUSPECTED';

export function getRuntimeLicenseState(env: NodeJS.ProcessEnv = process.env): RuntimeLicenseState {
  if ((env.NODE_ENV === 'development' || env.NODE_ENV === 'test') && env.APP_RUNTIME !== 'desktop' && env.PASKO_LICENSE_MODE === 'development') return 'VALID';
  const state = env.PASKO_LICENSE_STATE;
  return ['UNLICENSED','VALID','EXPIRED','INVALID','WRONG_INSTALLATION','NOT_YET_VALID','CLOCK_ROLLBACK_SUSPECTED'].includes(state ?? '') ? state as RuntimeLicenseState : 'UNLICENSED';
}

export function operationalLicenseRequired(env: NodeJS.ProcessEnv = process.env): void {
  if (getRuntimeLicenseState(env) !== 'VALID') throw new Error('LICENSE_RESTRICTED');
}

export function readLicenseMetadata(env: NodeJS.ProcessEnv = process.env): Record<string, string | null> | null {
  if (!env.PASKO_LICENSE_PAYLOAD) return null;
  try { return JSON.parse(Buffer.from(env.PASKO_LICENSE_PAYLOAD, 'base64url').toString('utf8')) as Record<string, string | null>; } catch { return null; }
}
