import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getInternalUrl } from './url-policy';

export type RuntimeTarget =
  | { kind: 'development'; url: URL }
  | { kind: 'packaged'; webRoot: string; serverPath: string };

export function resolvePackagedRuntime(resourcesPath: string): RuntimeTarget {
  const webRoot = path.resolve(resourcesPath, 'web');
  const manifest = JSON.parse(readFileSync(path.join(webRoot, 'runtime-manifest.json'), 'utf8')) as { server?: unknown };
  if (typeof manifest.server !== 'string' || !manifest.server) throw new Error('Packaged web runtime manifest has no server entry');
  const serverPath = path.resolve(webRoot, manifest.server);
  if (!serverPath.startsWith(`${webRoot}${path.sep}`)) throw new Error('Packaged web runtime server entry escapes the web resource root');
  return { kind: 'packaged', webRoot, serverPath };
}

export function resolveRuntimeTarget(input: { isPackaged: boolean; resourcesPath: string; developmentUrl?: string }): RuntimeTarget {
  if (!input.isPackaged) return { kind: 'development', url: getInternalUrl(input.developmentUrl) };
  return resolvePackagedRuntime(input.resourcesPath);
}
