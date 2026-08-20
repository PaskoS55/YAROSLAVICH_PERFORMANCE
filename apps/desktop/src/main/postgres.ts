import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { findAvailableLoopbackPort } from './runtime-port';

export const POSTGRES_MAJOR = '16';
export const DEFAULT_DATABASE = 'pasko_performance';
export const PRODUCT_DATA_DIRECTORY = 'PaskoPerformance';
export const LEGACY_DATA_DIRECTORY = 'YaroslavichPerformance';
export const BOOTSTRAP_USER = 'yp_bootstrap';
export const APPLICATION_USER = 'yp_app';
const REQUIRED_BINARIES = ['postgres', 'initdb', 'pg_ctl', 'pg_isready', 'createdb', 'pg_dump', 'pg_restore', 'psql'] as const;

export type ClusterState = 'absent' | 'valid' | 'invalid';
export interface PostgresPaths { runtimeRoot: string; bin: Record<(typeof REQUIRED_BINARIES)[number], string>; dataDirectory: string; logsDirectory: string; runtimeDirectory: string }
export interface CommandSpec { executable: string; args: string[] }
export interface RunningPostgres { port: number; paths: PostgresPaths; stop: () => Promise<boolean> }

export function resolvePostgresPaths(input: { resourcesPath: string; localAppData: string; dataRoot?: string }): PostgresPaths {
  const runtimeRoot = path.resolve(input.resourcesPath, 'postgres');
  const userRoot = path.resolve(input.dataRoot ?? path.join(input.localAppData, PRODUCT_DATA_DIRECTORY));
  return {
    runtimeRoot,
    bin: Object.fromEntries(REQUIRED_BINARIES.map((name) => [name, path.join(runtimeRoot, 'bin', `${name}.exe`)])) as PostgresPaths['bin'],
    dataDirectory: path.join(userRoot, 'database', 'pg16'),
    logsDirectory: path.join(userRoot, 'logs', 'postgres'),
    runtimeDirectory: path.join(userRoot, 'runtime'),
  };
}

export function detectLegacyDataRoot(localAppData: string): string | null {
  const legacy = path.resolve(localAppData, LEGACY_DATA_DIRECTORY);
  try { return statSync(legacy).isDirectory() ? legacy : null; } catch { return null; }
}

export function detectClusterState(dataDirectory: string): ClusterState {
  try {
    if (!statSync(dataDirectory).isDirectory()) return 'invalid';
  } catch (error) { return (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'absent' : 'invalid'; }
  try {
    const version = readFileSync(path.join(dataDirectory, 'PG_VERSION'), 'utf8').trim();
    return version === POSTGRES_MAJOR && statSync(path.join(dataDirectory, 'global', 'pg_control')).isFile() ? 'valid' : 'invalid';
  } catch { return 'invalid'; }
}

export function buildInitDbCommand(paths: PostgresPaths, passwordFile: string): CommandSpec {
  return { executable: paths.bin.initdb, args: ['-D', paths.dataDirectory, '-U', BOOTSTRAP_USER, '--encoding=UTF8', '--auth-host=scram-sha-256', '--auth-local=scram-sha-256', `--pwfile=${passwordFile}`, '--data-checksums'] };
}
export function buildPgCtlStartCommand(paths: PostgresPaths, port: number, logFile: string): CommandSpec {
  return { executable: paths.bin.pg_ctl, args: ['start', '-D', paths.dataDirectory, '-l', logFile, '-w', '-t', '25', '-o', `-h 127.0.0.1 -p ${port}`] };
}
export function buildPgCtlStopCommand(paths: PostgresPaths): CommandSpec { return { executable: paths.bin.pg_ctl, args: ['stop', '-D', paths.dataDirectory, '-m', 'fast', '-w', '-t', '25'] }; }
export function buildLocalDatabaseUrl(input: { host: string; port: number; database: string; username: string; password: string }): string {
  return `postgresql://${encodeURIComponent(input.username)}:${encodeURIComponent(input.password)}@${input.host}:${input.port}/${encodeURIComponent(input.database)}`;
}
export function redactDatabaseText(value: unknown): string { return String(value).replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, 'postgresql://[REDACTED]@').replace(/(password\s*[=:]\s*)[^\s;]+/gi, '$1[REDACTED]'); }

async function run(command: CommandSpec, options: { env?: NodeJS.ProcessEnv; input?: string; allowFailure?: boolean } = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command.executable, command.args, { windowsHide: true, env: options.env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); }); child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.once('error', reject); child.once('exit', (code) => { const result = { code: code ?? -1, stdout, stderr }; if (result.code !== 0 && !options.allowFailure) reject(new Error(`PostgreSQL command failed (${path.basename(command.executable)}, code ${result.code}): ${redactDatabaseText(stderr || stdout)}`)); else resolve(result); });
    if (options.input) child.stdin.end(options.input); else child.stdin.end();
  });
}

function postgresEnv(password: string): NodeJS.ProcessEnv { return { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, PGPASSWORD: password, PGCLIENTENCODING: 'UTF8' }; }

export async function initializeCluster(paths: PostgresPaths, bootstrapPassword: string): Promise<boolean> {
  const state = detectClusterState(paths.dataDirectory);
  if (state === 'valid') return false;
  if (state === 'invalid') throw new Error('PostgreSQL data directory exists but is incomplete, corrupt, or has an unsupported major version');
  mkdirSync(paths.runtimeDirectory, { recursive: true }); mkdirSync(path.dirname(paths.dataDirectory), { recursive: true });
  const passwordFile = path.join(paths.runtimeDirectory, `initdb-password-${process.pid}-${randomBytes(8).toString('hex')}.tmp`);
  try { writeFileSync(passwordFile, bootstrapPassword, { encoding: 'utf8', mode: 0o600, flag: 'wx' }); await run(buildInitDbCommand(paths, passwordFile)); }
  finally { rmSync(passwordFile, { force: true }); }
  verifyHostAuthentication(paths.dataDirectory);
  return true;
}

export function verifyHostAuthentication(dataDirectory: string): void {
  const lines = readFileSync(path.join(dataDirectory, 'pg_hba.conf'), 'utf8').split(/\r?\n/).map((line) => line.replace(/#.*/, '').trim()).filter(Boolean);
  const host = lines.filter((line) => /^host\S*\s/.test(line));
  if (!host.length || host.some((line) => !/\s127\.0\.0\.1\/32\s+scram-sha-256\s*$/.test(line) && !/\s::1\/128\s+scram-sha-256\s*$/.test(line))) throw new Error('pg_hba.conf contains a non-loopback or non-SCRAM host rule');
}

async function isReady(paths: PostgresPaths, port: number, password: string): Promise<boolean> {
  const result = await run({ executable: paths.bin.pg_isready, args: ['-h', '127.0.0.1', '-p', String(port), '-U', BOOTSTRAP_USER, '-d', 'postgres', '-t', '2'] }, { env: postgresEnv(password), allowFailure: true });
  return result.code === 0;
}

export async function startPostgres(paths: PostgresPaths, bootstrapPassword: string): Promise<RunningPostgres> {
  if (detectClusterState(paths.dataDirectory) !== 'valid') throw new Error('Cannot start an absent or invalid PostgreSQL cluster');
  mkdirSync(paths.logsDirectory, { recursive: true });
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const port = await findAvailableLoopbackPort(); const logFile = path.join(paths.logsDirectory, `postgres-${Date.now()}-${attempt}.log`);
    try {
      await run(buildPgCtlStartCommand(paths, port, logFile), { env: postgresEnv(bootstrapPassword) });
      const deadline = Date.now() + 25_000;
      while (Date.now() < deadline) { if (await isReady(paths, port, bootstrapPassword)) { let stopped = false; return { port, paths, stop: async () => { if (stopped) return false; stopped = true; await stopPostgres(paths, bootstrapPassword); return true; } }; } await new Promise((resolve) => setTimeout(resolve, 250)); }
      throw new Error('PostgreSQL readiness timed out');
    } catch (error) { lastError = error; await stopPostgres(paths, bootstrapPassword).catch(() => undefined); }
  }
  throw new Error('PostgreSQL failed to start after 3 loopback port attempts', { cause: lastError });
}

export async function stopPostgres(paths: PostgresPaths, bootstrapPassword: string): Promise<boolean> {
  const status = await run({ executable: paths.bin.pg_ctl, args: ['status', '-D', paths.dataDirectory] }, { env: postgresEnv(bootstrapPassword), allowFailure: true });
  if (status.code !== 0) return false;
  await run(buildPgCtlStopCommand(paths), { env: postgresEnv(bootstrapPassword) }); return true;
}

export async function ensureApplicationDatabase(runtime: RunningPostgres, credentials: { bootstrapPassword: string; applicationPassword: string }): Promise<void> {
  const base = ['-h', '127.0.0.1', '-p', String(runtime.port), '-U', BOOTSTRAP_USER, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'];
  const roleSql = `SELECT 'CREATE ROLE ${APPLICATION_USER} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD ' || quote_literal('${credentials.applicationPassword}') WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${APPLICATION_USER}') \\gexec\n`;
  await run({ executable: runtime.paths.bin.psql, args: base }, { env: postgresEnv(credentials.bootstrapPassword), input: roleSql });
  const exists = await run({ executable: runtime.paths.bin.psql, args: [...base, '-tAc', `SELECT 1 FROM pg_database WHERE datname='${DEFAULT_DATABASE}'`] }, { env: postgresEnv(credentials.bootstrapPassword) });
  if (exists.stdout.trim() !== '1') await run({ executable: runtime.paths.bin.createdb, args: ['-h', '127.0.0.1', '-p', String(runtime.port), '-U', BOOTSTRAP_USER, '-O', APPLICATION_USER, DEFAULT_DATABASE] }, { env: postgresEnv(credentials.bootstrapPassword) });
}

export async function executeSql(input: { runtime: RunningPostgres; username: string; password: string; database: string; sql: string }): Promise<string> {
  const result = await run({ executable: input.runtime.paths.bin.psql, args: ['-h', '127.0.0.1', '-p', String(input.runtime.port), '-U', input.username, '-d', input.database, '-v', 'ON_ERROR_STOP=1', '-tA'] }, { env: postgresEnv(input.password), input: input.sql });
  return result.stdout.trim();
}
