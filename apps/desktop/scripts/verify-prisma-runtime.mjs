import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { prismaRuntimePaths, PRISMA_VERSION } from './prisma-runtime-layout.mjs';

const root = path.resolve(import.meta.dirname, '..', '.runtime', 'db');
const paths = prismaRuntimePaths(root);
for (const file of [paths.cli, paths.schemaEngine, paths.queryEngine, paths.client, paths.schema, paths.bootstrap, paths.demoBootstrap]) {
  if (!(await stat(file)).isFile()) throw new Error(`Missing packaged Prisma runtime file: ${file}`);
}
const version = JSON.parse(await readFile(path.join(root, 'node_modules/prisma/package.json'), 'utf8')).version;
if (version !== PRISMA_VERSION) throw new Error(`Expected Prisma ${PRISMA_VERSION}, found ${version}`);
const entries = await readdir(paths.migrations, { withFileTypes: true });
const directories = entries.filter((entry) => entry.isDirectory());
if (!directories.length) throw new Error('Packaged migration history is empty');
await stat(path.join(paths.migrations, 'migration_lock.toml'));
for (const directory of directories) await stat(path.join(paths.migrations, directory.name, 'migration.sql'));
for (const required of ['20260821090000_add_organization_branding', '20260821110000_add_multi_team_context_indexes']) {
  if (!directories.some((entry) => entry.name === required)) throw new Error(`Required migration missing: ${required}`);
}
console.log(`Verified packaged Prisma ${version} runtime with ${directories.length} migrations: ${root}`);
