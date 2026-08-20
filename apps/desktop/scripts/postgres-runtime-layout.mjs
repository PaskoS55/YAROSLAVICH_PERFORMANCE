import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

export const REQUIRED_EXECUTABLES = ['postgres.exe', 'initdb.exe', 'pg_ctl.exe', 'pg_isready.exe', 'createdb.exe', 'pg_dump.exe', 'pg_restore.exe', 'psql.exe'];

export async function pathExists(target) {
  try { await stat(target); return true; } catch (error) { if (error?.code === 'ENOENT') return false; throw error; }
}

export function validatePostgresManifest(value) {
  if (!value || value.version !== '16.14' || value.major !== 16 || value.platform !== 'win32' || value.arch !== 'x64') throw new Error('PostgreSQL runtime manifest platform/version is invalid');
  if (typeof value.archive !== 'string' || !/^postgresql-16\.14-\d+-windows-x64-binaries\.zip$/.test(value.archive)) throw new Error('PostgreSQL runtime archive is invalid');
  if (typeof value.url !== 'string' || new URL(value.url).protocol !== 'https:' || !value.url.endsWith(`/${value.archive}`)) throw new Error('PostgreSQL runtime URL is invalid');
  if (typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)) throw new Error('PostgreSQL runtime SHA-256 is invalid');
  return value;
}

export async function readPostgresManifest(file) { return validatePostgresManifest(JSON.parse(await readFile(file, 'utf8'))); }

export async function sha256File(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export async function assertChecksum(file, expected) {
  const actual = await sha256File(file);
  if (actual !== expected.toLowerCase()) throw new Error(`PostgreSQL archive checksum mismatch: expected ${expected}, got ${actual}`);
  return actual;
}

export function assertSafePostgresStagingPath(target, allowedRoot) {
  const resolved = path.resolve(target); const allowed = path.resolve(allowedRoot);
  if (resolved === allowed || !resolved.startsWith(`${allowed}${path.sep}`)) throw new Error(`Refusing to clean PostgreSQL staging outside ${allowed}: ${resolved}`);
  return resolved;
}

export async function cleanPostgresStaging(target, allowedRoot) { await rm(assertSafePostgresStagingPath(target, allowedRoot), { recursive: true, force: true }); }

export async function findDistributionRoot(extractedRoot) {
  const direct = path.join(extractedRoot, 'bin', 'postgres.exe');
  if (await pathExists(direct)) return extractedRoot;
  const candidates = [];
  for (const entry of await readdir(extractedRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && await pathExists(path.join(extractedRoot, entry.name, 'bin', 'postgres.exe'))) candidates.push(path.join(extractedRoot, entry.name));
  }
  if (candidates.length !== 1) throw new Error(`Expected exactly one PostgreSQL distribution root, found ${candidates.length}`);
  return candidates[0];
}

export async function verifyPostgresRuntime(root) {
  const info = await lstat(root); if (info.isSymbolicLink()) throw new Error('PostgreSQL runtime root must not be a symlink');
  for (const name of REQUIRED_EXECUTABLES) if (!(await pathExists(path.join(root, 'bin', name)))) throw new Error(`Required PostgreSQL executable is missing: ${name}`);
  for (const directory of ['lib', 'share']) if (!(await pathExists(path.join(root, directory)))) throw new Error(`Required PostgreSQL runtime directory is missing: ${directory}`);
  let files = 0; let bytes = 0;
  async function walk(directory) { for (const entry of await readdir(directory, { withFileTypes: true })) { const target = path.join(directory, entry.name); const item = await lstat(target); if (item.isSymbolicLink()) throw new Error(`PostgreSQL runtime must not contain symlinks: ${target}`); if (entry.isDirectory()) await walk(target); else { files += 1; bytes += item.size; } } }
  await walk(root); await mkdir(root, { recursive: true });
  return { files, bytes };
}
