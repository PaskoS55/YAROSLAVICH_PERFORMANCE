import { describe, expect, it } from 'vitest';
import { getRuntimeLicenseState, operationalLicenseRequired, trialDisplay } from './license-policy';

describe('trusted runtime license policy', () => {
  it('allows explicit non-desktop development only', () => {
    expect(getRuntimeLicenseState({ NODE_ENV: 'development', APP_RUNTIME: 'web', PASKO_LICENSE_MODE: 'development' })).toBe('VALID');
    expect(getRuntimeLicenseState({ NODE_ENV: 'production', APP_RUNTIME: 'desktop', PASKO_LICENSE_MODE: 'development' })).toBe('UNLICENSED');
    expect(getRuntimeLicenseState({ NODE_ENV: 'development', APP_RUNTIME: 'desktop', PASKO_LICENSE_MODE: 'development' })).toBe('UNLICENSED');
  });
  it('blocks operational mutations while backup/recovery policy can remain separate', () => {
    expect(() => operationalLicenseRequired({ NODE_ENV: 'production', APP_RUNTIME: 'desktop', PASKO_LICENSE_STATE: 'EXPIRED' })).toThrow('LICENSE_RESTRICTED');
    expect(() => operationalLicenseRequired({ NODE_ENV: 'production', APP_RUNTIME: 'desktop', PASKO_LICENSE_STATE: 'VALID' })).not.toThrow();
  });
});

describe('trial display', () => {
  it('uses verified expiry with UTC-safe remaining days', () => {
    expect(trialDisplay({ plan: 'TRIAL', expiresAt: '2026-09-23T23:59:59.000Z' }, new Date('2026-09-20T22:00:00.000-03:00'))).toMatchObject({ daysRemaining: 2 });
    expect(trialDisplay({ plan: 'PRO', expiresAt: '2026-09-23T00:00:00.000Z' })).toBeNull();
  });
});
