import packageMetadata from '../package.json';

export const PRODUCT_VERSION = packageMetadata.version;
export const PRODUCT_VERSION_MAJOR_MINOR = PRODUCT_VERSION.split('.').slice(0, 2).join('.');

export function runtimeProductVersion(): string {
  return process.env.PASKO_PRODUCT_VERSION || PRODUCT_VERSION;
}
