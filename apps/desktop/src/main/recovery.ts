import { createHash, randomUUID, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statfsSync,
  statSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import path from "node:path";
import type { PostgresPaths, RunningPostgres } from "./postgres";
import { APPLICATION_USER, BOOTSTRAP_USER, DEFAULT_DATABASE, POSTGRES_MAJOR, executeSql } from "./postgres";
import type { PrismaRuntimePaths } from "./prisma-runtime-paths";

export const SNAPSHOT_FORMAT_VERSION = 1;
export const SNAPSHOT_RETENTION = 5;
export const RECOVERY_STATUS_VERSION = 1;
const MIN_SNAPSHOT_BYTES = 1024;
const DISK_MARGIN_BYTES = 64 * 1024 * 1024;
const SNAPSHOT_ID = /^[0-9a-f-]{36}$/;

export interface MigrationState {
  packaged: string[];
  applied: string[];
  pending: string[];
  failed: string[];
  fresh: boolean;
}

export interface SnapshotManifest {
  snapshotFormatVersion: 1;
  snapshotId: string;
  createdAt: string;
  reason: "PRE_MIGRATION" | "PRE_RESTORE" | "USER_REQUESTED";
  productVersion: string;
  databaseName: string;
  postgresMajor: string;
  schemaMigrationNames: string[];
  lastAppliedMigration: string | null;
  targetMigrationSet: string[];
  installationId: string;
  databaseFileChecksum: string;
  sizeBytes: number;
  criticalCounts: CriticalCounts;
}

export interface CriticalCounts {
  organizations: number;
  teams: number;
  seasons: number;
  players: number;
  localUsers: number;
  testResults: number;
  qcFlags: number;
  referenceProfiles: number;
  activeProfileSelections: number;
}

const EMPTY_COUNTS: CriticalCounts = { organizations: 0, teams: 0, seasons: 0, players: 0, localUsers: 0, testResults: 0, qcFlags: 0, referenceProfiles: 0, activeProfileSelections: 0 };
export const emptyCriticalCounts = (): CriticalCounts => ({ ...EMPTY_COUNTS });

export interface RecoveryStatus {
  statusVersion: 1;
  state: "HEALTHY" | "MIGRATION_FAILED" | "RESTORE_FAILED";
  occurredAt: string;
  snapshotId: string | null;
  publicMessage: string;
  technicalCode: string;
  attempts: number;
}

export interface RecoveryPaths {
  root: string;
  snapshots: string;
  manifests: string;
  status: string;
}

export type PgUtilityRunner = (input: {
  executable: string;
  args: string[];
  password: string;
}) => Promise<{ stdout: string }>;

export function resolveRecoveryPaths(productDataRoot: string): RecoveryPaths {
  const root = path.resolve(productDataRoot, "recovery");
  return {
    root,
    snapshots: path.join(root, "snapshots"),
    manifests: path.join(root, "manifests"),
    status: path.join(root, "status.json"),
  };
}

export function listPackagedMigrationNames(paths: PrismaRuntimePaths): string[] {
  return readdirSync(paths.migrations, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function determineMigrationState(
  packaged: string[],
  appliedRows: Array<{ name: string; finished: boolean; rolledBack: boolean }>,
  migrationTableExists: boolean,
): MigrationState {
  const applied = appliedRows
    .filter((row) => row.finished && !row.rolledBack)
    .map((row) => row.name)
    .sort();
  const failed = appliedRows
    .filter((row) => !row.finished && !row.rolledBack)
    .map((row) => row.name)
    .sort();
  const appliedSet = new Set(applied);
  return {
    packaged: [...packaged].sort(),
    applied,
    pending: packaged.filter((name) => !appliedSet.has(name)).sort(),
    failed,
    fresh: !migrationTableExists,
  };
}

export function sha256File(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

export function redactSensitiveText(value: unknown): string {
  return String(value)
    .replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, "postgresql://[REDACTED]@")
    .replace(/(authorization\s*:\s*)(?:bearer\s+)?[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/(cookie\s*:\s*)[^\r\n]+/gi, "$1[REDACTED]")
    .replace(
      /((?:password|passwordHash|recoveryKey|recoveryKeyHash|databasePassword|authSessionSecret|installationSecret|encryptedPayload)\s*[=:]\s*)[^\s;,}\]]+/gi,
      "$1[REDACTED]",
    );
}

export async function verifyLocalPasswordHash(password: string, encoded: string): Promise<boolean> {
  try {
    const [algorithm, version, parameters, saltText, keyText] = encoded.split('$');
    if (algorithm !== 'scrypt' || version !== 'v1' || parameters !== 'N=32768,r=8,p=1') return false;
    const expected = Buffer.from(keyText, 'base64url');
    const actual = await new Promise<Buffer>((resolve, reject) => nodeScrypt(password, Buffer.from(saltText, 'base64url'), expected.length, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch { return false; }
}

export const runPgUtility: PgUtilityRunner = ({ executable, args, password }) =>
  new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      windowsHide: true,
      env: {
        SystemRoot: process.env.SystemRoot,
        WINDIR: process.env.WINDIR,
        PGPASSWORD: password,
        PGCLIENTENCODING: "UTF8",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += String(chunk)));
    child.stderr.on("data", (chunk) => (stderr += String(chunk)));
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve({ stdout })
        : reject(new Error(`RECOVERY_UTILITY_FAILED:${path.basename(executable)}:${code}:${redactSensitiveText(stderr).slice(-500)}`)),
    );
  });

function ensureRecoveryDirectories(paths: RecoveryPaths): void {
  mkdirSync(paths.snapshots, { recursive: true });
  mkdirSync(paths.manifests, { recursive: true });
}

export function hasSufficientDiskSpace(directory: string, databaseSize: number): boolean {
  const fs = statfsSync(directory);
  const available = Number(fs.bavail) * Number(fs.bsize);
  return available >= Math.max(databaseSize * 2, databaseSize + DISK_MARGIN_BYTES);
}

export function retainLatestSnapshots(paths: RecoveryPaths, keep = SNAPSHOT_RETENTION): void {
  const manifests = listSnapshotManifests(paths).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const manifest of manifests.slice(keep)) {
    if (!SNAPSHOT_ID.test(manifest.snapshotId)) continue;
    rmSync(path.join(paths.snapshots, `${manifest.snapshotId}.dump`), { force: true });
    rmSync(path.join(paths.manifests, `${manifest.snapshotId}.json`), { force: true });
  }
}

export function listSnapshotManifests(paths: RecoveryPaths): SnapshotManifest[] {
  try {
    return readdirSync(paths.manifests)
      .filter((name) => name.endsWith(".json") && SNAPSHOT_ID.test(name.slice(0, -5)))
      .flatMap((name) => {
        try {
          return [JSON.parse(readFileSync(path.join(paths.manifests, name), "utf8")) as SnapshotManifest];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

export async function createInternalSnapshot(input: {
  paths: RecoveryPaths;
  postgres: RunningPostgres;
  password: string;
  installationId: string;
  productVersion: string;
  migrationState: MigrationState;
  databaseSize: number;
  reason: SnapshotManifest["reason"];
  runner?: PgUtilityRunner;
  now?: Date;
  snapshotId?: string;
  criticalCounts?: CriticalCounts;
}): Promise<SnapshotManifest> {
  ensureRecoveryDirectories(input.paths);
  if (!hasSufficientDiskSpace(input.paths.root, input.databaseSize))
    throw new Error("RECOVERY_DISK_SPACE_INSUFFICIENT");
  const snapshotId = input.snapshotId ?? randomUUID();
  if (!SNAPSHOT_ID.test(snapshotId)) throw new Error("RECOVERY_SNAPSHOT_ID_INVALID");
  const runner = input.runner ?? runPgUtility;
  const temporaryDump = path.join(input.paths.snapshots, `${snapshotId}.dump.tmp`);
  const finalDump = path.join(input.paths.snapshots, `${snapshotId}.dump`);
  const temporaryManifest = path.join(input.paths.manifests, `${snapshotId}.json.tmp`);
  const finalManifest = path.join(input.paths.manifests, `${snapshotId}.json`);
  try {
    await runner({
      executable: input.postgres.paths.bin.pg_dump,
      args: ["-h", "127.0.0.1", "-p", String(input.postgres.port), "-U", APPLICATION_USER, "-d", DEFAULT_DATABASE, "-Fc", "-f", temporaryDump],
      password: input.password,
    });
    const sizeBytes = statSync(temporaryDump).size;
    if (sizeBytes < MIN_SNAPSHOT_BYTES) throw new Error("RECOVERY_SNAPSHOT_TOO_SMALL");
    await runner({ executable: input.postgres.paths.bin.pg_restore, args: ["--list", temporaryDump], password: input.password });
    const databaseFileChecksum = sha256File(temporaryDump);
    const manifest: SnapshotManifest = {
      snapshotFormatVersion: SNAPSHOT_FORMAT_VERSION,
      snapshotId,
      createdAt: (input.now ?? new Date()).toISOString(),
      reason: input.reason,
      productVersion: input.productVersion,
      databaseName: DEFAULT_DATABASE,
      postgresMajor: POSTGRES_MAJOR,
      schemaMigrationNames: input.migrationState.applied,
      lastAppliedMigration: input.migrationState.applied.at(-1) ?? null,
      targetMigrationSet: input.migrationState.packaged,
      installationId: input.installationId,
      databaseFileChecksum,
      sizeBytes,
      criticalCounts: input.criticalCounts ?? EMPTY_COUNTS,
    };
    writeFileSync(temporaryManifest, JSON.stringify(manifest, null, 2), { encoding: "utf8", flag: "wx" });
    renameSync(temporaryDump, finalDump);
    renameSync(temporaryManifest, finalManifest);
    retainLatestSnapshots(input.paths);
    return manifest;
  } catch (error) {
    rmSync(temporaryDump, { force: true });
    rmSync(temporaryManifest, { force: true });
    throw error;
  }
}

export async function validateInternalSnapshot(input: {
  paths: RecoveryPaths;
  manifest: SnapshotManifest;
  installationId: string;
  runner?: PgUtilityRunner;
  postgresPaths: PostgresPaths;
  password: string;
}): Promise<string> {
  const { manifest } = input;
  if (manifest.snapshotFormatVersion !== SNAPSHOT_FORMAT_VERSION) throw new Error("RECOVERY_FORMAT_UNSUPPORTED");
  if (!SNAPSHOT_ID.test(manifest.snapshotId)) throw new Error("RECOVERY_SNAPSHOT_ID_INVALID");
  if (manifest.installationId !== input.installationId) throw new Error("RECOVERY_INSTALLATION_MISMATCH");
  if (manifest.postgresMajor !== POSTGRES_MAJOR) throw new Error("RECOVERY_POSTGRES_VERSION_MISMATCH");
  const archive = path.join(input.paths.snapshots, `${manifest.snapshotId}.dump`);
  const stat = statSync(archive);
  if (stat.size !== manifest.sizeBytes || sha256File(archive) !== manifest.databaseFileChecksum)
    throw new Error("RECOVERY_CHECKSUM_MISMATCH");
  await (input.runner ?? runPgUtility)({ executable: input.postgresPaths.bin.pg_restore, args: ["--list", archive], password: input.password });
  return archive;
}

export async function readCriticalCounts(input: { postgres: RunningPostgres; password: string }): Promise<CriticalCounts> {
  const value = await executeSql({ runtime: input.postgres, username: APPLICATION_USER, password: input.password, database: DEFAULT_DATABASE, sql: `SELECT
    (SELECT count(*) FROM organizations),
    (SELECT count(*) FROM teams),
    (SELECT count(*) FROM seasons),
    (SELECT count(*) FROM players),
    (SELECT count(*) FROM local_users),
    (SELECT count(*) FROM test_results),
    (SELECT count(*) FROM qc_flags);` });
  const numbers = value.split('|').map(Number);
  if (numbers.length !== 7 || numbers.some((item) => !Number.isSafeInteger(item) || item < 0)) throw new Error('RECOVERY_HEALTH_COUNTS_INVALID');
  const hasProfiles = await executeSql({ runtime: input.postgres, username: APPLICATION_USER, password: input.password, database: DEFAULT_DATABASE, sql: `SELECT to_regclass('public.norm_profiles') IS NOT NULL;` });
  const hasSelection = await executeSql({ runtime: input.postgres, username: APPLICATION_USER, password: input.password, database: DEFAULT_DATABASE, sql: `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='teams' AND column_name='active_norm_profile_id');` });
  const referenceProfiles = hasProfiles === 't' ? Number(await executeSql({ runtime: input.postgres, username: APPLICATION_USER, password: input.password, database: DEFAULT_DATABASE, sql: `SELECT count(*) FROM norm_profiles WHERE scope='SYSTEM' AND status='ACTIVE' AND deleted_at IS NULL;` })) : 0;
  const activeProfileSelections = hasSelection === 't' ? Number(await executeSql({ runtime: input.postgres, username: APPLICATION_USER, password: input.password, database: DEFAULT_DATABASE, sql: `SELECT count(*) FROM teams WHERE active_norm_profile_id IS NOT NULL;` })) : 0;
  return { organizations: numbers[0], teams: numbers[1], seasons: numbers[2], players: numbers[3], localUsers: numbers[4], testResults: numbers[5], qcFlags: numbers[6], referenceProfiles, activeProfileSelections };
}

export async function checkDatabaseHealth(input: { postgres: RunningPostgres; password: string; expected: CriticalCounts }): Promise<{ healthy: boolean; currentMigration: string | null; counts: CriticalCounts }> {
  const migration = await executeSql({ runtime: input.postgres, username: APPLICATION_USER, password: input.password, database: DEFAULT_DATABASE, sql: `SELECT COALESCE((SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY finished_at DESC LIMIT 1),'');` });
  const failed = await executeSql({ runtime: input.postgres, username: APPLICATION_USER, password: input.password, database: DEFAULT_DATABASE, sql: `SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;` });
  const counts = await readCriticalCounts(input);
  const exactKeys: Array<keyof CriticalCounts> = ['organizations','teams','seasons','players','localUsers','testResults','qcFlags','activeProfileSelections'];
  const healthy = failed === '0' && exactKeys.every((key) => counts[key] === input.expected[key]) && counts.referenceProfiles >= input.expected.referenceProfiles && counts.referenceProfiles >= 1;
  return { healthy, currentMigration: migration || null, counts };
}

export async function restoreInternalSnapshot(input: {
  paths: RecoveryPaths;
  manifest: SnapshotManifest;
  postgres: RunningPostgres;
  bootstrapPassword: string;
  applicationPassword: string;
  installationId: string;
  productVersion: string;
  currentMigrationState: MigrationState;
  currentCounts: CriticalCounts;
  databaseSize: number;
  migrateAndBootstrap: () => Promise<void>;
  runner?: PgUtilityRunner;
}): Promise<{ preRestoreSnapshot: SnapshotManifest; health: Awaited<ReturnType<typeof checkDatabaseHealth>> }> {
  const archive = await validateInternalSnapshot({ paths: input.paths, manifest: input.manifest, installationId: input.installationId, postgresPaths: input.postgres.paths, password: input.applicationPassword, runner: input.runner });
  const preRestoreSnapshot = await createInternalSnapshot({ paths: input.paths, postgres: input.postgres, password: input.applicationPassword, installationId: input.installationId, productVersion: input.productVersion, migrationState: input.currentMigrationState, databaseSize: input.databaseSize, criticalCounts: input.currentCounts, reason: 'PRE_RESTORE', runner: input.runner });
  await validateInternalSnapshot({ paths: input.paths, manifest: preRestoreSnapshot, installationId: input.installationId, postgresPaths: input.postgres.paths, password: input.applicationPassword, runner: input.runner });
  try {
    await executeSql({ runtime: input.postgres, username: BOOTSTRAP_USER, password: input.bootstrapPassword, database: 'postgres', sql: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DEFAULT_DATABASE}' AND pid <> pg_backend_pid();\nDROP DATABASE IF EXISTS ${DEFAULT_DATABASE};\nCREATE DATABASE ${DEFAULT_DATABASE} OWNER ${APPLICATION_USER};` });
    await (input.runner ?? runPgUtility)({ executable: input.postgres.paths.bin.pg_restore, args: ['--no-owner','--no-privileges','-h','127.0.0.1','-p',String(input.postgres.port),'-U',APPLICATION_USER,'-d',DEFAULT_DATABASE,archive], password: input.applicationPassword });
    await input.migrateAndBootstrap();
    const health = await checkDatabaseHealth({ postgres: input.postgres, password: input.applicationPassword, expected: input.manifest.criticalCounts });
    if (!health.healthy) throw new Error('RECOVERY_HEALTH_CHECK_FAILED');
    clearRecoveryStatus(input.paths);
    return { preRestoreSnapshot, health };
  } catch (error) {
    writeRecoveryStatus(input.paths, { state: 'RESTORE_FAILED', occurredAt: new Date().toISOString(), snapshotId: preRestoreSnapshot.snapshotId, publicMessage: 'Восстановление не завершено. Исходная точка и PRE-RESTORE snapshot сохранены.', technicalCode: 'RESTORE_FAILED' });
    throw error;
  }
}

export interface DisposableTestMarker { version: 1; runId: string; root: string }
export function writeDisposableTestMarker(root: string, runId: string): DisposableTestMarker {
  const resolved = path.resolve(root);
  const tempRoot = path.resolve('C:\\Temp');
  if (path.dirname(resolved) !== tempRoot || !path.basename(resolved).startsWith('pasko_phase7_') || !/^[a-z0-9-]{8,}$/i.test(runId)) throw new Error('DESTRUCTIVE_TEST_TARGET_REJECTED');
  mkdirSync(resolved, { recursive: true });
  const marker = { version: 1 as const, runId, root: resolved };
  writeFileSync(path.join(resolved, '.pasko-phase7-disposable.json'), JSON.stringify(marker), { encoding: 'utf8', flag: 'wx' });
  return marker;
}
export function assertDisposableTestTarget(target: string, marker: DisposableTestMarker): string {
  const resolved = path.resolve(target);
  if (resolved !== marker.root || path.dirname(resolved) !== path.resolve('C:\\Temp') || !path.basename(resolved).startsWith('pasko_phase7_')) throw new Error('DESTRUCTIVE_TEST_TARGET_REJECTED');
  const stored = JSON.parse(readFileSync(path.join(resolved, '.pasko-phase7-disposable.json'), 'utf8')) as DisposableTestMarker;
  if (stored.version !== 1 || stored.runId !== marker.runId || stored.root !== resolved) throw new Error('DESTRUCTIVE_TEST_MARKER_INVALID');
  return resolved;
}

export function writeRecoveryStatus(paths: RecoveryPaths, status: Omit<RecoveryStatus, "statusVersion" | "attempts">): RecoveryStatus {
  ensureRecoveryDirectories(paths);
  let attempts = 1;
  try {
    const previous = JSON.parse(readFileSync(paths.status, "utf8")) as RecoveryStatus;
    if (previous.state === status.state && previous.snapshotId === status.snapshotId) attempts = previous.attempts + 1;
  } catch {}
  const value: RecoveryStatus = { statusVersion: RECOVERY_STATUS_VERSION, ...status, attempts };
  const temporary = `${paths.status}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2), { encoding: "utf8" });
  renameSync(temporary, paths.status);
  return value;
}

export function clearRecoveryStatus(paths: RecoveryPaths): void {
  rmSync(paths.status, { force: true });
}

export function appendRedactedRuntimeLog(logsRoot: string, message: string, maxFiles = 5, maxBytes = 2 * 1024 * 1024): void {
  mkdirSync(logsRoot, { recursive: true });
  const target = path.join(logsRoot, "runtime.log");
  try {
    if (statSync(target).size >= maxBytes) {
      const rotated = path.join(logsRoot, `runtime-${Date.now()}.log`);
      renameSync(target, rotated);
    }
  } catch {}
  appendFileSync(target, `${new Date().toISOString()} ${redactSensitiveText(message)}\n`, "utf8");
  const files = readdirSync(logsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^runtime(?:-\d+)?\.log$/.test(entry.name))
    .map((entry) => ({ name: entry.name, time: statSync(path.join(logsRoot, entry.name)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  for (const file of files.slice(maxFiles)) rmSync(path.join(logsRoot, file.name), { force: true });
}
