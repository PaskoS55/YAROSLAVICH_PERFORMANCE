import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildLocalDatabaseUrl,
  ensureApplicationDatabase,
  initializeCluster,
  resolvePostgresPaths,
  rotateDatabaseCredentials,
  startPostgres,
  type RunningPostgres,
  APPLICATION_USER,
  DEFAULT_DATABASE,
  executeSql,
  ensureDemoDatabase,
  DEMO_DATABASE,
} from "./postgres";
import type { DatabaseCredentialsProvider } from "./database-credentials";
import {
  buildMigrateDeployArgs,
  buildPrismaUtilityEnv,
  resolvePrismaRuntime,
  verifyPrismaRuntime,
  type PrismaRuntimePaths,
} from "./prisma-runtime-paths";
import {
  clearRecoveryStatus,
  createInternalSnapshot,
  determineMigrationState,
  listPackagedMigrationNames,
  resolveRecoveryPaths,
  readCriticalCounts,
  writeRecoveryStatus,
  type MigrationState,
  type RecoveryPaths,
  type SnapshotManifest,
  listSnapshotManifests,
  restoreInternalSnapshot,
  verifyLocalPasswordHash,
  emptyCriticalCounts,
} from "./recovery";

export interface PackagedDatabaseRuntime {
  databaseUrl: string;
  demoDatabaseUrl: string | null;
  postgres: RunningPostgres;
  migrationState: MigrationState;
  recoveryPaths: RecoveryPaths;
  startupSnapshot: SnapshotManifest | null;
  stop: () => Promise<boolean>;
}
type UtilityRunner = (
  entry: string,
  args: string[],
  options: { cwd: string; env: Record<string, string>; serviceName: string },
) => Promise<void>;

const runUtility: UtilityRunner = (entry, args, options) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry, ...args], {
      cwd: options.cwd,
      windowsHide: true,
      env: { ...options.env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let diagnostic = "";
    child.stderr?.on("data", (chunk: unknown) => {
      diagnostic = `${diagnostic}${String(chunk)}`.slice(-4000);
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `${options.serviceName} failed (${code})${diagnostic ? ": output redacted" : ""}`,
            ),
          ),
    );
  });

export async function beforeDatabaseMigration(
  paths: PrismaRuntimePaths,
): Promise<void> {
  verifyPrismaRuntime(paths);
}

export function parseAppliedMigrationRows(value: string): Array<{ name: string; finished: boolean; rolledBack: boolean }> {
  if (!value.trim()) return [];
  return value.split(/\r?\n/).map((line) => {
    const [name, finished, rolledBack] = line.split("|");
    if (!name || !["t", "f"].includes(finished) || !["t", "f"].includes(rolledBack))
      throw new Error("MIGRATION_STATE_INVALID");
    return { name, finished: finished === "t", rolledBack: rolledBack === "t" };
  });
}

export async function inspectMigrationState(input: {
  postgres: RunningPostgres;
  applicationPassword: string;
  prismaPaths: PrismaRuntimePaths;
}): Promise<MigrationState> {
  const table = await executeSql({ runtime: input.postgres, username: APPLICATION_USER, password: input.applicationPassword, database: DEFAULT_DATABASE, sql: "SELECT to_regclass('public._prisma_migrations') IS NOT NULL;" });
  const exists = table === "t";
  const rows = exists
    ? parseAppliedMigrationRows(await executeSql({ runtime: input.postgres, username: APPLICATION_USER, password: input.applicationPassword, database: DEFAULT_DATABASE, sql: `SELECT migration_name, finished_at IS NOT NULL, rolled_back_at IS NOT NULL FROM _prisma_migrations ORDER BY started_at;` }))
    : [];
  return determineMigrationState(listPackagedMigrationNames(input.prismaPaths), rows, exists);
}

export async function migrateAndBootstrap(input: {
  paths: PrismaRuntimePaths;
  databaseUrl: string;
  source: NodeJS.ProcessEnv;
  runner?: UtilityRunner;
}): Promise<void> {
  const runner = input.runner ?? runUtility;
  const env = buildPrismaUtilityEnv({
    databaseUrl: input.databaseUrl,
    paths: input.paths,
    source: input.source,
  });
  await beforeDatabaseMigration(input.paths);
  await runner(input.paths.cli, buildMigrateDeployArgs(input.paths), {
    cwd: input.paths.root,
    env,
    serviceName: "PASKO Prisma Migrate Deploy",
  });
  await runner(input.paths.bootstrap, [], {
    cwd: input.paths.root,
    env,
    serviceName: "PASKO Reference Bootstrap",
  });
}

export async function migrateAndBootstrapDemo(input: {
  paths: PrismaRuntimePaths;
  databaseUrl: string;
  source: NodeJS.ProcessEnv;
  runner?: UtilityRunner;
}): Promise<void> {
  const runner = input.runner ?? runUtility;
  const env = buildPrismaUtilityEnv({ databaseUrl: input.databaseUrl, paths: input.paths, source: input.source });
  await beforeDatabaseMigration(input.paths);
  await runner(input.paths.cli, buildMigrateDeployArgs(input.paths), { cwd: input.paths.root, env, serviceName: "PASKO Demo Prisma Migrate Deploy" });
  await runner(input.paths.demoBootstrap, [], { cwd: input.paths.root, env, serviceName: "PASKO Demo Dataset Bootstrap" });
}

export async function startPackagedDatabase(input: {
  licensingEnforcement?: boolean;
  resourcesPath: string;
  localAppData: string;
  dataRoot?: string;
  credentialsProvider: DatabaseCredentialsProvider;
  rotateTo?: { bootstrapPassword: string; applicationPassword: string };
  source: NodeJS.ProcessEnv;
}): Promise<PackagedDatabaseRuntime> {
  const credentials = await input.credentialsProvider.getCredentials();
  const paths = resolvePostgresPaths({
    resourcesPath: input.resourcesPath,
    localAppData: input.localAppData,
    dataRoot: input.dataRoot,
  });
  const prismaPaths = resolvePrismaRuntime(input.resourcesPath);
  const productDataRoot = path.resolve(input.dataRoot ?? path.join(input.localAppData, "PaskoPerformance"));
  const recoveryPaths = resolveRecoveryPaths(productDataRoot);
  await initializeCluster(paths, credentials.bootstrapPassword);
  const postgres = await startPostgres(paths, credentials.bootstrapPassword);
  try {
    await ensureApplicationDatabase(postgres, credentials);
    if (input.rotateTo)
      await rotateDatabaseCredentials(postgres, credentials, input.rotateTo);
    const active = input.rotateTo ?? credentials;
    const databaseUrl = buildLocalDatabaseUrl({
      host: "127.0.0.1",
      port: postgres.port,
      database: DEFAULT_DATABASE,
      username: APPLICATION_USER,
      password: active.applicationPassword,
    });
    const migrationState = await inspectMigrationState({ postgres, applicationPassword: active.applicationPassword, prismaPaths });
    if (migrationState.failed.length) {
      writeRecoveryStatus(recoveryPaths, { state: "MIGRATION_FAILED", occurredAt: new Date().toISOString(), snapshotId: null, publicMessage: "Не удалось безопасно открыть локальную базу данных.", technicalCode: "FAILED_MIGRATION_STATE" });
      throw new Error("FAILED_MIGRATION_STATE");
    }
    let startupSnapshot: SnapshotManifest | null = null;
    if (!migrationState.fresh && migrationState.pending.length) {
      try {
        const databaseSize = Number(await executeSql({ runtime: postgres, username: APPLICATION_USER, password: active.applicationPassword, database: DEFAULT_DATABASE, sql: `SELECT pg_database_size('${DEFAULT_DATABASE}');` }));
        const criticalCounts = await readCriticalCounts({ postgres, password: active.applicationPassword });
        startupSnapshot = await createInternalSnapshot({
          paths: recoveryPaths,
          postgres,
          password: active.applicationPassword,
          installationId: input.source.PASKO_INSTALLATION_ID ?? "",
          productVersion: input.source.PASKO_PRODUCT_VERSION ?? "1.0.0",
          migrationState,
          databaseSize,
          criticalCounts,
          reason: "PRE_MIGRATION",
        });
      } catch (error) {
        writeRecoveryStatus(recoveryPaths, { state: "MIGRATION_FAILED", occurredAt: new Date().toISOString(), snapshotId: null, publicMessage: error instanceof Error && error.message === "RECOVERY_DISK_SPACE_INSUFFICIENT" ? "Недостаточно свободного места для безопасного обновления базы данных." : "Не удалось создать безопасную точку восстановления. База данных не была обновлена.", technicalCode: "PRE_MIGRATION_SNAPSHOT_FAILED" });
        throw error;
      }
    }
    try {
      await migrateAndBootstrap({ paths: prismaPaths, databaseUrl, source: input.source });
    } catch (error) {
      writeRecoveryStatus(recoveryPaths, { state: "MIGRATION_FAILED", occurredAt: new Date().toISOString(), snapshotId: startupSnapshot?.snapshotId ?? null, publicMessage: "База данных не была обновлена. Ваши данные не были автоматически удалены.", technicalCode: "MIGRATE_DEPLOY_FAILED" });
      throw error;
    }
    let demoDatabaseUrl: string | null = null;
    if (input.licensingEnforcement === false || input.source.PASKO_LICENSE_STATE === 'VALID') {
      try {
        await ensureDemoDatabase(postgres, active);
        const candidate = buildLocalDatabaseUrl({ host: '127.0.0.1', port: postgres.port, database: DEMO_DATABASE, username: APPLICATION_USER, password: active.applicationPassword });
        await migrateAndBootstrapDemo({ paths: prismaPaths, databaseUrl: candidate, source: input.source });
        demoDatabaseUrl = candidate;
      } catch {
        demoDatabaseUrl = null;
      }
    }
    input.source.PASKO_DEMO_AVAILABLE = demoDatabaseUrl ? '1' : '0';
    clearRecoveryStatus(recoveryPaths);
    return { databaseUrl, demoDatabaseUrl, postgres, migrationState, recoveryPaths, startupSnapshot, stop: postgres.stop };
  } catch (error) {
    await postgres.stop().catch(() => undefined);
    throw error;
  }
}

export function resolveE2eDataRoot(
  source: NodeJS.ProcessEnv,
): string | undefined {
  return source.PASKO_E2E_MODE === "1" && source.PASKO_E2E_DATA_ROOT
    ? path.resolve(source.PASKO_E2E_DATA_ROOT)
    : undefined;
}

export async function restorePackagedDatabaseSnapshot(input: {
  resourcesPath: string;
  localAppData: string;
  dataRoot?: string;
  credentialsProvider: DatabaseCredentialsProvider;
  source: NodeJS.ProcessEnv;
  snapshotId: string;
  confirmation: string;
  password: string;
  installationConfirmation: string;
}): Promise<void> {
  if (input.confirmation !== 'ВОССТАНОВИТЬ') throw new Error('RECOVERY_CONFIRMATION_REQUIRED');
  const credentials = await input.credentialsProvider.getCredentials();
  const postgresPaths = resolvePostgresPaths({ resourcesPath: input.resourcesPath, localAppData: input.localAppData, dataRoot: input.dataRoot });
  const prismaPaths = resolvePrismaRuntime(input.resourcesPath);
  const recoveryPaths = resolveRecoveryPaths(path.resolve(input.dataRoot ?? path.join(input.localAppData, 'PaskoPerformance')));
  const available = listSnapshotManifests(recoveryPaths);
  const listed = available.find((item) => item.snapshotId === input.snapshotId);
  if (!listed) throw new Error('RECOVERY_SNAPSHOT_NOT_FOUND');
  const manifest = JSON.parse(readFileSync(path.join(recoveryPaths.manifests, `${input.snapshotId}.json`), 'utf8')) as SnapshotManifest;
  const postgres = await startPostgres(postgresPaths, credentials.bootstrapPassword);
  try {
    let authAvailable = true;
    let passwordVerified = false;
    try {
      const hashes = await executeSql({ runtime: postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: DEFAULT_DATABASE, sql: `SELECT password_hash FROM local_users WHERE disabled_at IS NULL;` });
      for (const hash of hashes.split(/\r?\n/).filter(Boolean)) if (await verifyLocalPasswordHash(input.password, hash)) { passwordVerified = true; break; }
    } catch { authAvailable = false; }
    if (authAvailable && !passwordVerified) throw new Error('RECOVERY_ADMIN_PASSWORD_INVALID');
    if (!authAvailable && input.installationConfirmation !== (input.source.PASKO_INSTALLATION_ID ?? '').slice(-8)) throw new Error('RECOVERY_INSTALLATION_CONFIRMATION_INVALID');
    let migrationState: MigrationState;
    try { migrationState = await inspectMigrationState({ postgres, applicationPassword: credentials.applicationPassword, prismaPaths }); }
    catch { migrationState = determineMigrationState(listPackagedMigrationNames(prismaPaths), [], true); }
    let currentCounts = emptyCriticalCounts();
    try { currentCounts = await readCriticalCounts({ postgres, password: credentials.applicationPassword }); } catch {}
    const databaseSize = Number(await executeSql({ runtime: postgres, username: APPLICATION_USER, password: credentials.applicationPassword, database: DEFAULT_DATABASE, sql: `SELECT pg_database_size('${DEFAULT_DATABASE}');` }));
    const databaseUrl = buildLocalDatabaseUrl({ host: '127.0.0.1', port: postgres.port, database: DEFAULT_DATABASE, username: APPLICATION_USER, password: credentials.applicationPassword });
    await restoreInternalSnapshot({ paths: recoveryPaths, manifest, postgres, bootstrapPassword: credentials.bootstrapPassword, applicationPassword: credentials.applicationPassword, installationId: input.source.PASKO_INSTALLATION_ID ?? '', productVersion: input.source.PASKO_PRODUCT_VERSION ?? '1.0.0', currentMigrationState: migrationState, currentCounts, databaseSize, migrateAndBootstrap: () => migrateAndBootstrap({ paths: prismaPaths, databaseUrl, source: input.source }) });
  } finally { await postgres.stop().catch(() => false); }
}
