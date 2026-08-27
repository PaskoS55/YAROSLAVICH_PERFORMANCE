import { describe, expect, it } from 'vitest';
import { LICENSING_ENFORCEMENT, getRuntimeLicenseState, operationalLicenseAllowed, operationalLicenseRequired, trialDisplay } from './license-policy';

describe('trusted runtime license policy', () => {
  it('allows explicit non-desktop development only', () => {
    expect(getRuntimeLicenseState({ NODE_ENV: 'development', APP_RUNTIME: 'web', PASKO_LICENSE_MODE: 'development' })).toBe('VALID');
    expect(getRuntimeLicenseState({ NODE_ENV: 'production', APP_RUNTIME: 'desktop', PASKO_LICENSE_MODE: 'development' })).toBe('UNLICENSED');
    expect(getRuntimeLicenseState({ NODE_ENV: 'development', APP_RUNTIME: 'desktop', PASKO_LICENSE_MODE: 'development' })).toBe('UNLICENSED');
  });
  it.each(['UNLICENSED', 'INVALID', 'EXPIRED', 'VALID', 'WRONG_INSTALLATION', 'NOT_YET_VALID', 'CLOCK_ROLLBACK_SUSPECTED'])('allows v1.0 operations for %s without falsifying verification state', (state) => {
    const env: NodeJS.ProcessEnv = { NODE_ENV: 'production', APP_RUNTIME: 'desktop', PASKO_LICENSE_STATE: state };
    expect(LICENSING_ENFORCEMENT).toBe(false);
    expect(getRuntimeLicenseState(env)).toBe(state);
    expect(operationalLicenseAllowed(env)).toBe(true);
    expect(() => operationalLicenseRequired(env)).not.toThrow();
  });
  it('cannot toggle product enforcement through environment variables', () => {
    for (const value of ['ON', 'OFF', 'true', 'false', '1', '0']) {
      expect(operationalLicenseAllowed({ NODE_ENV: 'production', APP_RUNTIME: 'desktop', LICENSING_ENFORCEMENT: value, PASKO_LICENSE_ENFORCEMENT: value })).toBe(true);
    }
  });
});

describe('trial display', () => {
  it('uses verified expiry with UTC-safe remaining days', () => {
    expect(trialDisplay({ plan: 'TRIAL', expiresAt: '2026-09-23T23:59:59.000Z' }, new Date('2026-09-20T22:00:00.000-03:00'))).toMatchObject({ daysRemaining: 2 });
    expect(trialDisplay({ plan: 'PRO', expiresAt: '2026-09-23T00:00:00.000Z' })).toBeNull();
  });
});
