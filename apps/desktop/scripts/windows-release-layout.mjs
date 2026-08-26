import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { lstat, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const RELEASE_PLATFORM = 'windows';
export const RELEASE_ARCH = 'x64';

export async function readReleaseIdentity(repositoryRoot) {
  const readJson = async (file) => JSON.parse(await readFile(path.join(repositoryRoot, file), 'utf8'));
  const rootPackage = await readJson('package.json');
  const product = await readJson('packages/core/product-identity.json');
  const versionFiles = ['apps/desktop/package.json', 'apps/web/package.json', 'packages/core/package.json', 'packages/db/package.json'];
  const versions = await Promise.all(versionFiles.map(async (file) => ({ file, version: (await readJson(file)).version })));
  if (!/^\d+\.\d+\.\d+$/.test(rootPackage.version ?? '')) throw new Error('Canonical release version must be strict semver');
  for (const item of versions) if (item.version !== rootPackage.version) throw new Error(`Version mismatch: ${item.file} is ${item.version}, expected ${rootPackage.version}`);
  return {
    version: rootPackage.version,
    product,
    artifactName: `${product.releaseArtifactPrefix}-${rootPackage.version}.exe`,
  };
}

export function releasePaths(repositoryRoot, identity) {
  const desktopRoot = path.join(repositoryRoot, 'apps', 'desktop');
  return {
    repositoryRoot,
    desktopRoot,
    packagedRoot: path.join(desktopRoot, 'out', `${identity.product.shortProductName}-win32-x64`),
    makerRoot: path.join(desktopRoot, 'out', 'make', 'squirrel.windows', 'x64'),
    makerArtifact: path.join(desktopRoot, 'out', 'make', 'squirrel.windows', 'x64', identity.artifactName),
    releaseRoot: path.join(repositoryRoot, 'release'),
    releaseArtifact: path.join(repositoryRoot, 'release', identity.artifactName),
    manifest: path.join(repositoryRoot, 'release', 'release-manifest.json'),
    checksums: path.join(repositoryRoot, 'release', 'SHA256SUMS.txt'),
  };
}

export async function sha256File(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function existsFile(file) {
  try { return (await stat(file)).isFile(); } catch (error) { if (error?.code === 'ENOENT') return false; throw error; }
}

async function verifyPackagedPostgresCommands(postgresRoot) {
  for (const executable of ['initdb.exe', 'postgres.exe', 'pg_ctl.exe', 'pg_dump.exe', 'pg_restore.exe']) {
    const output = await new Promise((resolve, reject) => {
      const child = spawn(path.join(postgresRoot, 'bin', executable), ['--version'], {
        env: { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, PATH: `${process.env.SystemRoot}\\System32` },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let text = '';
      child.stdout.on('data', (chunk) => { text += String(chunk); });
      child.stderr.on('data', (chunk) => { text += String(chunk); });
      child.once('error', reject);
      child.once('exit', (code) => code === 0 ? resolve(text) : reject(new Error(`Packaged ${executable} --version exited ${code}`)));
    });
    if (!/16\.14/.test(output)) throw new Error(`Packaged ${executable} returned an unexpected version`);
  }
}

export async function auditRequiredPackagedRuntime(paths, identity) {
  const { readPostgresManifest, verifyMicrosoftRuntime } = await import('./postgres-runtime-layout.mjs');
  const resources = path.join(paths.packagedRoot, 'resources');
  const postgresRoot = path.join(resources, 'postgres');
  const required = [
    path.join(paths.packagedRoot, `${identity.product.executableName}.exe`),
    path.join(resources, 'app.asar'),
    path.join(resources, 'product-identity.json'),
    path.join(resources, 'web', 'runtime-manifest.json'),
    path.join(resources, 'postgres', 'bin', 'postgres.exe'),
    path.join(resources, 'postgres', 'bin', 'pg_ctl.exe'),
    path.join(resources, 'postgres', 'bin', 'pg_dump.exe'),
    path.join(resources, 'postgres', 'bin', 'pg_restore.exe'),
    path.join(resources, 'db', 'node_modules', 'prisma', 'build', 'index.js'),
    path.join(resources, 'db', 'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node'),
    path.join(resources, 'db', 'prisma', 'schema.prisma'),
    path.join(resources, 'db', 'prisma', 'migrations', 'migration_lock.toml'),
    path.join(resources, 'db', 'bootstrap-reference.cjs'),
    path.join(resources, 'db', 'bootstrap-demo.cjs'),
  ];
  const missing = [];
  for (const file of required) if (!(await existsFile(file))) missing.push(path.relative(paths.packagedRoot, file));
  if (missing.length) throw new Error(`Required packaged runtime files are missing:\n${missing.join('\n')}`);
  const postgresManifest = await readPostgresManifest(path.join(paths.desktopRoot, 'postgres-runtime.json'));
  await verifyMicrosoftRuntime(postgresRoot, postgresManifest);
  await verifyPackagedPostgresCommands(postgresRoot);
  return required;
}

const FORBIDDEN_NAME_PATTERNS = [
  /(^|[\\/])\.env(?:\.[^\\/]+)?$/i,
  /(^|[\\/])\.git([\\/]|$)/i,
  /\.pasko-license$/i,
  /(^|[\\/])(?:coverage|test-results|playwright-report)([\\/]|$)/i,
  /(?:^|[\\/])(?:backups|snapshots|database|pg16|logs)(?:[\\/]|$)/i,
  /\.(?:dump|pasko-backup)$/i,
];

export async function auditForbiddenFileNames(root) {
  const findings = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      const relative = path.relative(root, target);
      const info = await lstat(target);
      if (info.isSymbolicLink()) throw new Error(`Release package must not contain symlinks: ${relative}`);
      if (FORBIDDEN_NAME_PATTERNS.some((pattern) => pattern.test(relative))) findings.push(relative);
      if (entry.isDirectory()) await walk(target);
    }
  }
  await walk(root);
  if (findings.length) throw new Error(`Forbidden release artifacts found:\n${findings.join('\n')}`);
  return findings;
}

export async function auditAsarContents(asarFile) {
  const { extractFile, listPackage } = await import('@electron/asar');
  const entries = listPackage(asarFile);
  const forbidden = entries.filter((entry) =>
    /(^|[\\/])(?:\.cache|src|test|tests|coverage|scripts)([\\/]|$)/i.test(entry) ||
    /(^|[\\/])\.env(?:\.[^\\/]+)?$/i.test(entry) ||
    /test-license-issuer|\.pasko-license$/i.test(entry),
  );
  if (forbidden.length) throw new Error(`Forbidden ASAR entries found:\n${forbidden.join('\n')}`);
  const sensitiveMarkers = ['-----BEGIN PRIVATE KEY-----', '-----BEGIN OPENSSH PRIVATE KEY-----'];
  for (const entry of entries) {
    if (!/\.(?:c?js|mjs|json|pem|txt)$/i.test(entry)) continue;
    const content = extractFile(asarFile, entry.replace(/^[\\/]+/, ''));
    if (content.length > 2_000_000) continue;
    const text = content.toString('utf8');
    if (sensitiveMarkers.some((marker) => text.includes(marker))) throw new Error(`Private key material found in ASAR: ${entry}`);
  }
  return entries.length;
}

export function createReleaseManifest({ identity, artifactName, sizeBytes, sha256, createdAt = new Date().toISOString() }) {
  return {
    product: identity.product.canonical,
    displayName: identity.product.shortProductName,
    vertical: identity.product.vertical,
    version: identity.version,
    platform: RELEASE_PLATFORM,
    architecture: RELEASE_ARCH,
    artifact: artifactName,
    sizeBytes,
    sha256,
    signed: false,
    createdAt,
  };
}

export async function verifyReleaseOutputs(paths, identity) {
  const manifest = JSON.parse(await readFile(paths.manifest, 'utf8'));
  const artifact = await stat(paths.releaseArtifact);
  const digest = await sha256File(paths.releaseArtifact);
  const checksum = (await readFile(paths.checksums, 'utf8')).trim();
  const expectedChecksum = `${digest}  ${identity.artifactName}`;
  if (manifest.product !== identity.product.canonical || manifest.displayName !== identity.product.shortProductName || manifest.version !== identity.version) throw new Error('Release manifest identity/version mismatch');
  if (manifest.artifact !== identity.artifactName || manifest.sizeBytes !== artifact.size || manifest.sha256 !== digest || manifest.signed !== false) throw new Error('Release manifest artifact metadata mismatch');
  if (checksum !== expectedChecksum) throw new Error('SHA256SUMS.txt does not match the canonical installer');
  const releaseEntries = await readdir(paths.releaseRoot);
  const allowed = new Set([identity.artifactName, 'release-manifest.json', 'SHA256SUMS.txt']);
  const unexpected = releaseEntries.filter((entry) => !allowed.has(entry));
  if (unexpected.length) throw new Error(`Ambiguous release outputs found: ${unexpected.join(', ')}`);
  return { manifest, digest, sizeBytes: artifact.size };
}
