import { createWriteStream } from 'node:fs';
import { cp, mkdir, rename, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { assertChecksum, cleanPostgresStaging, findDistributionRoot, pathExists, readPostgresManifest, verifyPostgresRuntime } from './postgres-runtime-layout.mjs';

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = await readPostgresManifest(path.join(desktopRoot, 'postgres-runtime.json'));
const cacheRoot = path.resolve(process.env.PASKO_PERFORMANCE_POSTGRES_CACHE || path.join(desktopRoot, '.cache', 'postgres'));
const archive = path.join(cacheRoot, manifest.archive);
const runtimeRoot = path.join(desktopRoot, '.runtime', 'postgres');
const tempRoot = path.join(desktopRoot, '.runtime', `postgres-extract-${process.pid}`);

async function download() {
  await mkdir(cacheRoot, { recursive: true });
  const partial = `${archive}.partial`;
  await rm(partial, { force: true });
  const response = await fetch(manifest.url, { redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`PostgreSQL download failed with HTTP ${response.status}`);
  try { await pipeline(Readable.fromWeb(response.body), createWriteStream(partial, { flags: 'wx' })); await rename(partial, archive); }
  catch (error) { await rm(partial, { force: true }); throw error; }
}

async function extract() {
  await mkdir(tempRoot, { recursive: true });
  await new Promise((resolve, reject) => { const child = spawn('tar.exe', ['-xf', archive, '-C', tempRoot], { windowsHide: true, stdio: 'inherit' }); child.once('error', reject); child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`tar.exe exited with code ${code}`))); });
}

if (!(await pathExists(archive))) await download();
await assertChecksum(archive, manifest.sha256);
await cleanPostgresStaging(runtimeRoot, path.join(desktopRoot, '.runtime'));
await cleanPostgresStaging(tempRoot, path.join(desktopRoot, '.runtime'));
try {
  await extract();
  const distribution = await findDistributionRoot(tempRoot);
  await cp(distribution, runtimeRoot, { recursive: true, dereference: true });
  const result = await verifyPostgresRuntime(runtimeRoot);
  console.log(`Prepared PostgreSQL ${manifest.version} runtime: ${runtimeRoot}`);
  console.log(`Runtime files: ${result.files}; bytes: ${result.bytes}`);
} finally { await rm(tempRoot, { recursive: true, force: true }); }
