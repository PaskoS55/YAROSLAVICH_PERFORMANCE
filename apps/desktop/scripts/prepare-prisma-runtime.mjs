import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { prismaRuntimePaths, PRISMA_VERSION } from './prisma-runtime-layout.mjs';

const root = path.resolve(import.meta.dirname, '..', '.runtime', 'db');
const repo = path.resolve(import.meta.dirname, '../../..');
const paths = prismaRuntimePaths(root);
await rm(root, { recursive: true, force: true });
await mkdir(path.join(root, 'node_modules'), { recursive: true });
await mkdir(path.join(root, 'prisma'), { recursive: true });
await cp(path.join(repo, 'packages/db/prisma/schema.prisma'), paths.schema, { recursive: true });
await cp(path.join(repo, 'packages/db/prisma/migrations'), paths.migrations, { recursive: true });
await cp(path.join(repo, 'node_modules/prisma'), path.join(root, 'node_modules/prisma'), { recursive: true });
await cp(path.join(repo, 'node_modules/@prisma'), path.join(root, 'node_modules/@prisma'), { recursive: true });
await cp(path.join(repo, 'node_modules/.prisma'), path.join(root, 'node_modules/.prisma'), { recursive: true });
const actual = JSON.parse(await readFile(path.join(root, 'node_modules/prisma/package.json'), 'utf8')).version;
if (actual !== PRISMA_VERSION) throw new Error(`Expected Prisma ${PRISMA_VERSION}, found ${actual}`);
await new Promise((resolve, reject) => {
  const executable = process.execPath;
  const child = spawn(executable, [path.join(repo, 'node_modules/esbuild/bin/esbuild'), path.join(repo, 'packages/db/prisma/bootstrap-reference.ts'), '--bundle', '--platform=node', '--format=cjs', '--target=node20', '--external:@prisma/client', `--outfile=${paths.bootstrap}`], { cwd: repo, windowsHide: true, stdio: 'inherit' });
  child.once('error', reject); child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Reference bootstrap build failed (${code})`)));
});
console.log(`Prepared packaged Prisma ${actual} runtime: ${root}`);
