import { describe, expect, it } from 'vitest';
import { PRODUCT_ASSETS, PRODUCT_IDENTITY, validateOrganizationBranding } from './product';

describe('product identity', () => {
  it('keeps product, vertical, and organization at separate levels', () => {
    expect(PRODUCT_IDENTITY.canonical).toBe('PASKO PERFORMANCE PLATFORM');
    expect(PRODUCT_IDENTITY.vertical).toBe('VOLLEYBALL');
    expect(PRODUCT_IDENTITY.display).toBe('PASKO PERFORMANCE PLATFORM — VOLLEYBALL');
    expect(JSON.stringify(PRODUCT_IDENTITY).toLowerCase()).not.toContain('yaroslavich');
  });

  it('maps only canonical product assets under the PASKO product directory', () => {
    expect(PRODUCT_ASSETS).toEqual({
      logoLight: '/brand/pasko/pasko-logo-on-light.png',
      logoDark: '/brand/pasko/pasko-logo-on-dark.png',
      logoMaster: '/brand/pasko/pasko-performance-volleyball-master.png',
      mark: '/brand/pasko/pasko-mark-master.png',
    });
    expect(JSON.stringify(PRODUCT_ASSETS)).not.toContain('yaroslavich');
  });

  it('validates managed organization branding values', () => {
    expect(validateOrganizationBranding({ shortName: ' Club ', logoAssetKey: 'organizations/club/logo.png', primaryColor: '#123ABC' })).toEqual({ shortName: 'Club', logoAssetKey: 'organizations/club/logo.png', primaryColor: '#123ABC', secondaryColor: null });
    expect(() => validateOrganizationBranding({ logoAssetKey: '../logo.png' })).toThrow();
    expect(() => validateOrganizationBranding({ primaryColor: 'red' })).toThrow();
  });
});
