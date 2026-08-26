import { createWriteStream } from 'node:fs';
import { copyFile, cp, mkdir, rename, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { assertChecksum, cleanPostgresStaging, findDistributionRoot, pathExists, POSTGRES_RUNTIME_DIRECTORIES, readPostgresManifest, verifyPostgresRuntime } from './postgres-runtime-layout.mjs';

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = await readPostgresManifest(path.join(desktopRoot, 'postgres-runtime.json'));
const cacheRoot = path.resolve(process.env.PASKO_PERFORMANCE_POSTGRES_CACHE || path.join(desktopRoot, '.cache', 'postgres'));
const archive = path.join(cacheRoot, manifest.archive);
const vcRuntimeArchive = path.join(cacheRoot, manifest.microsoftRuntime.archive);
const extractorArchive = path.join(cacheRoot, manifest.microsoftRuntime.extractor.archive);
const runtimeRoot = path.join(desktopRoot, '.runtime', 'postgres');
const tempRoot = path.join(desktopRoot, '.runtime', `postgres-extract-${process.pid}`);
const vcTempRoot = path.join(desktopRoot, '.runtime', `vc-runtime-extract-${process.pid}`);

async function download(url, target, description) {
  await mkdir(cacheRoot, { recursive: true });
  const partial = `${target}.partial`;
  await rm(partial, { force: true });
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`${description} download failed with HTTP ${response.status}`);
  try { await pipeline(Readable.fromWeb(response.body), createWriteStream(partial, { flags: 'wx' })); await rename(partial, target); }
  catch (error) { await rm(partial, { force: true }); throw error; }
}

function run(command, args) {
  return new Promise((resolve, reject) => { const child = spawn(command, args, { windowsHide: true, stdio: 'inherit' }); child.once('error', reject); child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${path.basename(command)} exited with code ${code}`))); });
}

async function extractPostgres() {
  await mkdir(tempRoot, { recursive: true });
  await run('tar.exe', ['-xf', archive, '-C', tempRoot]);
}

async function addMicrosoftRuntime() {
  const toolsRoot = path.join(vcTempRoot, 'wix');
  const extractedRoot = path.join(vcTempRoot, 'redist');
  const cabRoot = path.join(extractedRoot, 'AttachedContainer', 'packages', 'vcRuntimeMinimum_amd64');
  const filesRoot = path.join(vcTempRoot, 'files');
  await mkdir(toolsRoot, { recursive: true });
  await mkdir(filesRoot, { recursive: true });
  await run('tar.exe', ['-xf', extractorArchive, '-C', toolsRoot]);
  await run(path.join(toolsRoot, 'dark.exe'), ['-nologo', '-x', extractedRoot, vcRuntimeArchive]);
  await run('expand.exe', [path.join(cabRoot, 'cab1.cab'), '-F:*', filesRoot]);
  for (const item of manifest.microsoftRuntime.files) {
    const source = path.join(filesRoot, item.source);
    await assertChecksum(source, item.sha256);
    await copyFile(source, path.join(runtimeRoot, 'bin', item.target));
  }
}

if (!(await pathExists(archive))) await download(manifest.url, archive, 'PostgreSQL');
if (!(await pathExists(vcRuntimeArchive))) await download(manifest.microsoftRuntime.url, vcRuntimeArchive, 'Microsoft VC++ runtime');
if (!(await pathExists(extractorArchive))) await download(manifest.microsoftRuntime.extractor.url, extractorArchive, 'WiX extractor');
await assertChecksum(archive, manifest.sha256);
await assertChecksum(vcRuntimeArchive, manifest.microsoftRuntime.sha256);
await assertChecksum(extractorArchive, manifest.microsoftRuntime.extractor.sha256);
await cleanPostgresStaging(runtimeRoot, path.join(desktopRoot, '.runtime'));
await cleanPostgresStaging(tempRoot, path.join(desktopRoot, '.runtime'));
await cleanPostgresStaging(vcTempRoot, path.join(desktopRoot, '.runtime'));
try {
  await extractPostgres();
  const distribution = await findDistributionRoot(tempRoot);
  await mkdir(runtimeRoot, { recursive: true });
  for (const directory of POSTGRES_RUNTIME_DIRECTORIES) {
    await cp(path.join(distribution, directory), path.join(runtimeRoot, directory), { recursive: true, dereference: true });
  }
  await addMicrosoftRuntime();
  const result = await verifyPostgresRuntime(runtimeRoot, manifest);
  console.log(`Prepared PostgreSQL ${manifest.version} runtime: ${runtimeRoot}`);
  console.log(`Microsoft VC++ app-local runtime: ${manifest.microsoftRuntime.version} (${manifest.microsoftRuntime.files.map((item) => item.target).join(', ')})`);
  console.log(`Runtime files: ${result.files}; bytes: ${result.bytes}`);
} finally { await rm(tempRoot, { recursive: true, force: true }); await rm(vcTempRoot, { recursive: true, force: true }); }
