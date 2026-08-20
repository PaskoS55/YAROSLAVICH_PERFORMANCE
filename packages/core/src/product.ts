import identity from '../product-identity.json';

export const PRODUCT_IDENTITY = Object.freeze(identity);

export type OrganizationBranding = {
  shortName?: string | null;
  logoAssetKey?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

const COLOR_PATTERN = /^(#[0-9a-f]{3,4}|#[0-9a-f]{6}|#[0-9a-f]{8})$/i;
const ASSET_KEY_PATTERN = /^[a-z0-9][a-z0-9/_.-]{0,126}[a-z0-9]$/i;

export function validateOrganizationBranding(value: OrganizationBranding): OrganizationBranding {
  const result = { ...value };
  for (const key of ['primaryColor', 'secondaryColor'] as const) {
    const color = result[key]?.trim() || null;
    if (color && !COLOR_PATTERN.test(color)) throw new Error(`${key} must be a CSS hexadecimal color`);
    result[key] = color;
  }
  const assetKey = result.logoAssetKey?.trim() || null;
  if (assetKey && (!ASSET_KEY_PATTERN.test(assetKey) || assetKey.includes('..'))) throw new Error('logoAssetKey must be a managed relative asset key');
  result.logoAssetKey = assetKey;
  result.shortName = result.shortName?.trim() || null;
  return result;
}
