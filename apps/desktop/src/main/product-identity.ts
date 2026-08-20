import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type DesktopProductIdentity = {
  canonical: string;
  vertical: string;
  display: string;
  short: string;
  electronName: string;
  executableName: string;
  appUserModelId: string;
  dataDirectoryName: string;
  databaseName: string;
  logPrefix: string;
};

export function resolveProductIdentityPath(input: { isPackaged: boolean; resourcesPath: string }): string {
  return input.isPackaged
    ? path.join(input.resourcesPath, 'product-identity.json')
    : path.resolve(__dirname, '../../../../packages/core/product-identity.json');
}

export function loadProductIdentity(input: { isPackaged: boolean; resourcesPath: string }): DesktopProductIdentity {
  const file = resolveProductIdentityPath(input);
  if (!existsSync(file)) throw new Error('Product identity configuration is missing');
  const value = JSON.parse(readFileSync(file, 'utf8')) as DesktopProductIdentity;
  if (!value.canonical || !value.appUserModelId || !value.dataDirectoryName || !value.databaseName) throw new Error('Product identity configuration is invalid');
  return value;
}
