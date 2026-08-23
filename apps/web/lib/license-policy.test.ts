import { describe, expect, it } from 'vitest';
import { getRuntimeLicenseState, operationalLicenseRequired } from './license-policy';

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
