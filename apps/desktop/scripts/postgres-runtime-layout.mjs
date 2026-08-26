import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

export const REQUIRED_EXECUTABLES = ['postgres.exe', 'initdb.exe', 'pg_ctl.exe', 'pg_isready.exe', 'createdb.exe', 'pg_dump.exe', 'pg_restore.exe', 'psql.exe'];
export const REQUIRED_SMOKE_EXECUTABLES = ['initdb.exe', 'postgres.exe', 'pg_ctl.exe', 'pg_dump.exe', 'pg_restore.exe'];
export const POSTGRES_RUNTIME_DIRECTORIES = ['bin', 'lib', 'share'];
const SYSTEM_DLLS = new Set([
  'advapi32.dll', 'bcrypt.dll', 'crypt32.dll', 'dbghelp.dll', 'gdi32.dll', 'iphlpapi.dll', 'kernel32.dll',
  'msvcrt.dll', 'mswsock.dll', 'netapi32.dll', 'ntdll.dll', 'ole32.dll', 'oleaut32.dll', 'secur32.dll', 'shell32.dll',
  'shlwapi.dll', 'user32.dll', 'userenv.dll', 'version.dll', 'winhttp.dll', 'winmm.dll', 'winspool.drv',
  'wldap32.dll', 'ws2_32.dll',
]);

export async function pathExists(target) {
  try { await stat(target); return true; } catch (error) { if (error?.code === 'ENOENT') return false; throw error; }
}

export function validatePostgresManifest(value) {
  if (!value || value.version !== '16.14' || value.major !== 16 || value.platform !== 'win32' || value.arch !== 'x64') throw new Error('PostgreSQL runtime manifest platform/version is invalid');
  if (typeof value.archive !== 'string' || !/^postgresql-16\.14-\d+-windows-x64-binaries\.zip$/.test(value.archive)) throw new Error('PostgreSQL runtime archive is invalid');
  if (typeof value.url !== 'string' || new URL(value.url).protocol !== 'https:' || !value.url.endsWith(`/${value.archive}`)) throw new Error('PostgreSQL runtime URL is invalid');
  if (typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)) throw new Error('PostgreSQL runtime SHA-256 is invalid');
  const runtime = value.microsoftRuntime;
  if (!runtime || runtime.version !== '14.51.36247.0') throw new Error('Microsoft VC++ runtime version is invalid');
  const runtimeUrl = new URL(runtime.url ?? '');
  if (runtimeUrl.protocol !== 'https:' || runtimeUrl.hostname !== 'download.visualstudio.microsoft.com' || !runtimeUrl.pathname.endsWith('/VC_redist.x64.exe') || runtime.archive !== `vc_redist.x64-${runtime.version}.exe`) throw new Error('Microsoft VC++ runtime source is invalid');
  if (typeof runtime.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(runtime.sha256)) throw new Error('Microsoft VC++ runtime SHA-256 is invalid');
  if (runtime.extractor?.url !== 'https://github.com/wixtoolset/wix3/releases/download/wix3112rtm/wix311-binaries.zip' || runtime.extractor?.archive !== 'wix311-binaries.zip' || !/^[a-f0-9]{64}$/.test(runtime.extractor?.sha256 ?? '')) throw new Error('Microsoft VC++ runtime extractor provenance is invalid');
  const expectedRuntimeFiles = new Set(['vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll']);
  if (!Array.isArray(runtime.files) || runtime.files.length !== expectedRuntimeFiles.size) throw new Error('Microsoft VC++ app-local runtime file list is invalid');
  for (const file of runtime.files) {
    if (!expectedRuntimeFiles.delete(file.target) || file.source !== `${file.target}_amd64` || !/^[a-f0-9]{64}$/.test(file.sha256 ?? '')) throw new Error('Microsoft VC++ app-local runtime file entry is invalid');
  }
  if (expectedRuntimeFiles.size) throw new Error('Microsoft VC++ app-local runtime file is missing from manifest');
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
  if (actual !== expected.toLowerCase()) throw new Error(`Runtime checksum mismatch for ${path.basename(file)}: expected ${expected}, got ${actual}`);
  return actual;
}

function readPeImports(buffer, source) {
  if (buffer.length < 0x40 || buffer.readUInt16LE(0) !== 0x5a4d) throw new Error(`Not a PE image: ${source}`);
  const pe = buffer.readUInt32LE(0x3c);
  if (pe + 24 > buffer.length || buffer.readUInt32LE(pe) !== 0x00004550) throw new Error(`Invalid PE signature: ${source}`);
  const sectionCount = buffer.readUInt16LE(pe + 6);
  const optionalSize = buffer.readUInt16LE(pe + 20);
  const optional = pe + 24;
  const magic = buffer.readUInt16LE(optional);
  const directoryOffset = optional + (magic === 0x20b ? 112 : magic === 0x10b ? 96 : -1);
  if (directoryOffset < optional) throw new Error(`Unsupported PE optional header: ${source}`);
  const importRva = buffer.readUInt32LE(directoryOffset + 8);
  const importSize = buffer.readUInt32LE(directoryOffset + 12);
  if (!importRva || !importSize) return [];
  const sections = [];
  const sectionTable = optional + optionalSize;
  for (let index = 0; index < sectionCount; index += 1) {
    const offset = sectionTable + index * 40;
    sections.push({ virtualSize: buffer.readUInt32LE(offset + 8), virtualAddress: buffer.readUInt32LE(offset + 12), rawSize: buffer.readUInt32LE(offset + 16), rawOffset: buffer.readUInt32LE(offset + 20) });
  }
  const rvaToOffset = (rva) => {
    const section = sections.find((item) => rva >= item.virtualAddress && rva < item.virtualAddress + Math.max(item.virtualSize, item.rawSize));
    if (!section) throw new Error(`PE RVA is outside sections in ${source}`);
    return section.rawOffset + rva - section.virtualAddress;
  };
  const imports = [];
  let descriptor = rvaToOffset(importRva);
  for (;;) {
    if (descriptor + 20 > buffer.length) throw new Error(`Truncated PE import table: ${source}`);
    const nameRva = buffer.readUInt32LE(descriptor + 12);
    if (!nameRva && buffer.readUInt32LE(descriptor) === 0 && buffer.readUInt32LE(descriptor + 16) === 0) break;
    const nameOffset = rvaToOffset(nameRva);
    const end = buffer.indexOf(0, nameOffset);
    if (end < 0) throw new Error(`Unterminated PE import name: ${source}`);
    imports.push(buffer.toString('ascii', nameOffset, end).toLowerCase());
    descriptor += 20;
  }
  return [...new Set(imports)].sort();
}

export async function readPortableExecutableImports(file) { return readPeImports(await readFile(file), file); }
function isWindowsSystemDll(name) { return SYSTEM_DLLS.has(name) || name.startsWith('api-ms-win-') || name.startsWith('ext-ms-win-'); }

export async function verifyPostgresDependencyClosure(root) {
  const bin = path.join(root, 'bin');
  const entries = await readdir(bin, { withFileTypes: true });
  const bundled = new Map(entries.filter((entry) => entry.isFile()).map((entry) => [entry.name.toLowerCase(), path.join(bin, entry.name)]));
  const queue = REQUIRED_SMOKE_EXECUTABLES.map((name) => name.toLowerCase());
  const visited = new Set(); const imports = new Set(); const missing = new Set();
  while (queue.length) {
    const name = queue.shift();
    if (visited.has(name)) continue;
    visited.add(name);
    const file = bundled.get(name);
    if (!file) { missing.add(name); continue; }
    for (const imported of await readPortableExecutableImports(file)) {
      imports.add(imported);
      if (bundled.has(imported)) queue.push(imported);
      else if (!isWindowsSystemDll(imported)) missing.add(imported);
    }
  }
  if (missing.size) throw new Error(`PostgreSQL has unbundled non-system PE dependencies: ${[...missing].sort().join(', ')}`);
  return { files: [...visited].sort(), imports: [...imports].sort() };
}

export async function verifyMicrosoftRuntime(root, manifest) {
  for (const item of manifest.microsoftRuntime.files) await assertChecksum(path.join(root, 'bin', item.target), item.sha256);
  return verifyPostgresDependencyClosure(root);
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

export async function verifyPostgresRuntime(root, manifest) {
  const info = await lstat(root); if (info.isSymbolicLink()) throw new Error('PostgreSQL runtime root must not be a symlink');
  for (const name of REQUIRED_EXECUTABLES) if (!(await pathExists(path.join(root, 'bin', name)))) throw new Error(`Required PostgreSQL executable is missing: ${name}`);
  for (const directory of POSTGRES_RUNTIME_DIRECTORIES) if (!(await pathExists(path.join(root, directory)))) throw new Error(`Required PostgreSQL runtime directory is missing: ${directory}`);
  let files = 0; let bytes = 0;
  async function walk(directory) { for (const entry of await readdir(directory, { withFileTypes: true })) { const target = path.join(directory, entry.name); const item = await lstat(target); if (item.isSymbolicLink()) throw new Error(`PostgreSQL runtime must not contain symlinks: ${target}`); if (entry.isDirectory()) await walk(target); else { files += 1; bytes += item.size; } } }
  await walk(root); await mkdir(root, { recursive: true });
  const dependencies = manifest ? await verifyMicrosoftRuntime(root, manifest) : undefined;
  return { files, bytes, dependencies };
}
