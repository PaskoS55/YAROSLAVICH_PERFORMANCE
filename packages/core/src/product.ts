import identity from '../product-identity.json';

export const PRODUCT_IDENTITY = Object.freeze(identity);

export const PRODUCT_ASSETS = Object.freeze({
  logoLight: '/brand/pasko/pasko-logo-on-light.png',
  logoDark: '/brand/pasko/pasko-logo-on-dark.png',
  logoMaster: '/brand/pasko/pasko-performance-volleyball-master.png',
  mark: '/brand/pasko/pasko-mark-master.png',
});

export type OrganizationBranding = {
  shortName?: string | null;
  logoAssetKey?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

export const ORGANIZATION_COLOR_PATTERN = /^#[0-9A-F]{6}$/;
const ASSET_KEY_PATTERN = /^[a-z0-9][a-z0-9/_.-]{0,126}[a-z0-9]$/i;

export function validateOrganizationBranding(value: OrganizationBranding): OrganizationBranding {
  const result = { ...value };
  for (const key of ['primaryColor', 'secondaryColor'] as const) {
    const color = result[key]?.trim() || null;
    const normalized = color?.toUpperCase() ?? null;
    if (normalized && !ORGANIZATION_COLOR_PATTERN.test(normalized)) throw new Error(`${key} must use #RRGGBB`);
    result[key] = normalized;
  }
  const assetKey = result.logoAssetKey?.trim() || null;
  if (assetKey && (!ASSET_KEY_PATTERN.test(assetKey) || assetKey.includes('..'))) throw new Error('logoAssetKey must be a managed relative asset key');
  result.logoAssetKey = assetKey;
  result.shortName = result.shortName?.trim() || null;
  return result;
}
