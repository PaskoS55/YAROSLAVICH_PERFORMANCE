import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

export const PACKAGED_PRISMA_VERSION = '5.22.0';
export interface PrismaRuntimePaths { root: string; cli: string; schemaEngine: string; queryEngine: string; client: string; schema: string; migrations: string; bootstrap: string }
export function resolvePrismaRuntime(resourcesPath: string): PrismaRuntimePaths {
  const root = path.resolve(resourcesPath, 'db');
  return { root, cli: path.join(root, 'node_modules/prisma/build/index.js'), schemaEngine: path.join(root, 'node_modules/@prisma/engines/schema-engine-windows.exe'), queryEngine: path.join(root, 'node_modules/.prisma/client/query_engine-windows.dll.node'), client: path.join(root, 'node_modules/.prisma/client/index.js'), schema: path.join(root, 'prisma/schema.prisma'), migrations: path.join(root, 'prisma/migrations'), bootstrap: path.join(root, 'bootstrap-reference.cjs') };
}
export function verifyPrismaRuntime(paths: PrismaRuntimePaths): void {
  for (const file of [paths.cli, paths.schemaEngine, paths.queryEngine, paths.client, paths.schema, paths.bootstrap]) if (!existsSync(file) || !statSync(file).isFile()) throw new Error(`Packaged Prisma runtime file is missing: ${path.basename(file)}`);
  const version = JSON.parse(readFileSync(path.join(paths.root, 'node_modules/prisma/package.json'), 'utf8')) as { version?: string };
  if (version.version !== PACKAGED_PRISMA_VERSION) throw new Error(`Unsupported packaged Prisma version: ${version.version ?? 'unknown'}`);
  const migrations = readdirSync(paths.migrations, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  if (!existsSync(path.join(paths.migrations, 'migration_lock.toml')) || !migrations.length || migrations.some((entry) => !existsSync(path.join(paths.migrations, entry.name, 'migration.sql')))) throw new Error('Packaged Prisma migration history is incomplete');
}
export function buildMigrateDeployArgs(paths: PrismaRuntimePaths): string[] { return ['migrate', 'deploy', '--schema', paths.schema]; }
export function buildPrismaUtilityEnv(input: { databaseUrl: string; paths: PrismaRuntimePaths; source: NodeJS.ProcessEnv }): Record<string, string> {
  const windows = Object.fromEntries(['SystemRoot', 'WINDIR'].flatMap((key) => input.source[key] ? [[key, input.source[key]!]] : []));
  return { ...windows, NODE_ENV: 'production', DATABASE_URL: input.databaseUrl, PRISMA_SCHEMA_ENGINE_BINARY: input.paths.schemaEngine, PRISMA_QUERY_ENGINE_LIBRARY: input.paths.queryEngine, PRISMA_HIDE_UPDATE_MESSAGE: '1' };
}
