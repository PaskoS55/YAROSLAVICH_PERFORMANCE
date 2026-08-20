import { lstat, readdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const WEB_PACKAGE_NAME = '@pasko-performance/web';

async function pathExists(target) {
  try { await stat(target); return true; } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function walk(directory, visitor) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    await visitor(target, entry);
    if (entry.isDirectory()) await walk(target, visitor);
  }
}

export async function findStandaloneServer(standaloneRoot) {
  if (!(await pathExists(standaloneRoot))) {
    throw new Error(`Next standalone output does not exist: ${standaloneRoot}`);
  }
  const candidates = [];
  await walk(standaloneRoot, async (target, entry) => {
    if (!entry.isFile() || entry.name !== 'server.js' || target.includes(`${path.sep}node_modules${path.sep}`)) return;
    const packagePath = path.join(path.dirname(target), 'package.json');
    if (!(await pathExists(packagePath))) return;
    const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
    if (packageJson.name === WEB_PACKAGE_NAME) candidates.push(target);
  });
  if (candidates.length !== 1) {
    throw new Error(`Expected exactly one ${WEB_PACKAGE_NAME} standalone server.js, found ${candidates.length}`);
  }
  return candidates[0];
}

export function assertSafeStagingPath(stagingPath, allowedRoot) {
  const resolvedStaging = path.resolve(stagingPath);
  const resolvedAllowed = path.resolve(allowedRoot);
  if (resolvedStaging === resolvedAllowed || !resolvedStaging.startsWith(`${resolvedAllowed}${path.sep}`)) {
    throw new Error(`Refusing to clean staging path outside ${resolvedAllowed}: ${resolvedStaging}`);
  }
  return resolvedStaging;
}

export async function cleanStagingPath(stagingPath, allowedRoot) {
  const safePath = assertSafeStagingPath(stagingPath, allowedRoot);
  await rm(safePath, { recursive: true, force: true });
}

export function createCopyPlan({ standaloneRoot, serverPath, stagingRoot, publicSource, staticSource }) {
  const relativeServer = path.relative(path.resolve(standaloneRoot), path.resolve(serverPath));
  if (!relativeServer || relativeServer.startsWith('..') || path.isAbsolute(relativeServer)) {
    throw new Error('Standalone server.js is outside the standalone root');
  }
  const stagedServer = path.join(stagingRoot, relativeServer);
  const appRoot = path.dirname(stagedServer);
  return {
    standaloneSource: standaloneRoot,
    stagingRoot,
    relativeServer,
    stagedServer,
    publicSource,
    publicTarget: path.join(appRoot, 'public'),
    staticSource,
    staticTarget: path.join(appRoot, '.next', 'static'),
  };
}

export async function verifyPreparedRuntime(plan) {
  if (!(await pathExists(plan.stagingRoot))) {
    throw new Error(`Required prepared runtime path is missing: ${plan.stagingRoot}`);
  }
  const rootInfo = await lstat(plan.stagingRoot);
  if (rootInfo.isSymbolicLink()) {
    throw new Error(`Prepared runtime root must not be a symlink or junction: ${plan.stagingRoot}`);
  }
  const required = [
    plan.stagedServer,
    path.join(path.dirname(plan.stagedServer), 'package.json'),
    plan.publicTarget,
    plan.staticTarget,
    path.join(plan.stagingRoot, 'node_modules', 'next'),
    path.join(plan.stagingRoot, 'node_modules', '@prisma', 'client'),
    path.join(plan.stagingRoot, 'node_modules', '.prisma', 'client'),
    path.join(plan.stagingRoot, 'runtime-manifest.json'),
  ];
  for (const target of required) {
    if (!(await pathExists(target))) throw new Error(`Required prepared runtime path is missing: ${target}`);
  }
  let files = 0;
  let bytes = 0;
  await walk(plan.stagingRoot, async (target, entry) => {
    const info = await lstat(target);
    if (info.isSymbolicLink()) throw new Error(`Prepared runtime must not contain symlinks or junctions: ${target}`);
    if (entry.isFile()) { files += 1; bytes += info.size; }
  });
  return { files, bytes };
}
