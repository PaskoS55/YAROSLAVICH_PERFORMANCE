import { spawn } from "node:child_process";
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
} from "./postgres";
import type { DatabaseCredentialsProvider } from "./database-credentials";
import {
  buildMigrateDeployArgs,
  buildPrismaUtilityEnv,
  resolvePrismaRuntime,
  verifyPrismaRuntime,
  type PrismaRuntimePaths,
} from "./prisma-runtime-paths";

export interface PackagedDatabaseRuntime {
  databaseUrl: string;
  postgres: RunningPostgres;
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
  // This fail-closed integrity boundary is where a future internal pg_dump snapshot runs.
  verifyPrismaRuntime(paths);
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

export async function startPackagedDatabase(input: {
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
    await migrateAndBootstrap({
      paths: prismaPaths,
      databaseUrl,
      source: input.source,
    });
    return { databaseUrl, postgres, stop: postgres.stop };
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
