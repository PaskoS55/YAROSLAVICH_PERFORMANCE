import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { APPLICATION_USER, BOOTSTRAP_USER, DEFAULT_DATABASE, ensureApplicationDatabase, executeSql, initializeCluster, resolvePostgresPaths, rotateDatabaseCredentials, startPostgres } from '../dist/main/postgres.js';

const desktopRoot = path.resolve(import.meta.dirname, '..');
const resourcesPath = process.env.PASKO_PERFORMANCE_POSTGRES_RESOURCES
  ? path.resolve(process.env.PASKO_PERFORMANCE_POSTGRES_RESOURCES)
  : path.join(desktopRoot, '.runtime');
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'pasko-performance-pg16-integration-'));
let credentials = { bootstrapPassword: randomBytes(32).toString('base64url'), applicationPassword: randomBytes(32).toString('base64url') };
const paths = resolvePostgresPaths({ resourcesPath, localAppData: temporaryRoot, dataRoot: temporaryRoot });
let runtime;

async function assertVersionCommands() {
  for (const executable of ['initdb.exe', 'postgres.exe', 'pg_ctl.exe', 'pg_dump.exe', 'pg_restore.exe']) {
    const output = await new Promise((resolve, reject) => {
      const child = spawn(path.join(path.dirname(paths.bin.initdb), executable), ['--version'], { env: { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, PATH: `${process.env.SystemRoot}\\System32` }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let text = '';
      child.stdout.on('data', (chunk) => { text += String(chunk); });
      child.stderr.on('data', (chunk) => { text += String(chunk); });
      child.once('error', reject);
      child.once('exit', (code) => code === 0 ? resolve(text) : reject(new Error(`${executable} --version exited ${code}`)));
    });
    if (!/16\.14/.test(output)) throw new Error(`${executable} returned an unexpected version`);
  }
}

async function assertLoopbackOnly(port) {
  const output = await new Promise((resolve, reject) => { const child = spawn('C:\\Windows\\System32\\netstat.exe', ['-ano', '-p', 'tcp'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); let text = ''; child.stdout.on('data', (chunk) => { text += String(chunk); }); child.once('error', reject); child.once('exit', (code) => code === 0 ? resolve(text) : reject(new Error(`netstat exited ${code}`))); });
  const listeners = output.split(/\r?\n/).filter((line) => line.includes(`:${port}`) && /LISTENING/i.test(line));
  if (!listeners.length || listeners.some((line) => !line.trim().startsWith(`TCP    127.0.0.1:${port}`))) throw new Error(`PostgreSQL listener is not loopback-only on port ${port}`);
}

try {
  await assertVersionCommands();
  if (!(await initializeCluster(paths, credentials.bootstrapPassword))) throw new Error('Disposable cluster was not initialized');
  runtime = await startPostgres(paths, credentials.bootstrapPassword);
  await assertLoopbackOnly(runtime.port);
  await ensureApplicationDatabase(runtime, credentials);
  await executeSql({ runtime, username: APPLICATION_USER, password: credentials.applicationPassword, database: DEFAULT_DATABASE, sql: 'CREATE TABLE phase4_persistence (id integer PRIMARY KEY, value text NOT NULL); INSERT INTO phase4_persistence VALUES (1, \'survives-restart\');\n' });
  const previous = credentials;
  credentials = { bootstrapPassword: randomBytes(32).toString('base64url'), applicationPassword: randomBytes(32).toString('base64url') };
  await rotateDatabaseCredentials(runtime, previous, credentials);
  let oldCredentialRejected = false;
  try { await executeSql({ runtime, username: APPLICATION_USER, password: previous.applicationPassword, database: DEFAULT_DATABASE, sql: 'SELECT 1;' }); } catch { oldCredentialRejected = true; }
  if (!oldCredentialRejected) throw new Error('Previous application credential remained valid after rotation');
  if (!(await runtime.stop()) || await runtime.stop()) throw new Error('PostgreSQL shutdown is not idempotent'); runtime = undefined;

  runtime = await startPostgres(paths, credentials.bootstrapPassword);
  const persisted = await executeSql({ runtime, username: APPLICATION_USER, password: credentials.applicationPassword, database: DEFAULT_DATABASE, sql: 'SELECT value FROM phase4_persistence WHERE id=1;\n' });
  if (persisted !== 'survives-restart') throw new Error('Persistence restart value mismatch');

  const postmasterPid = Number((await readFile(path.join(paths.dataDirectory, 'postmaster.pid'), 'utf8')).split(/\r?\n/, 1)[0]);
  process.kill(postmasterPid); runtime = undefined;
  await new Promise((resolve) => setTimeout(resolve, 1500));
  runtime = await startPostgres(paths, credentials.bootstrapPassword);
  const recovered = await executeSql({ runtime, username: APPLICATION_USER, password: credentials.applicationPassword, database: DEFAULT_DATABASE, sql: 'SELECT value FROM phase4_persistence WHERE id=1;\n' });
  if (recovered !== 'survives-restart') throw new Error('Unclean recovery value mismatch');
  await runtime.stop(); runtime = undefined;
  console.log(`PostgreSQL integration PASS: five packaged --version commands, initdb, SCRAM, create database, credential rotation/old rejection, persistence, unclean recovery, loopback listener, fast shutdown (${BOOTSTRAP_USER}/${APPLICATION_USER}; credentials redacted)`);
} finally {
  if (runtime) await runtime.stop().catch(() => undefined);
  await rm(temporaryRoot, { recursive: true, force: true });
}
