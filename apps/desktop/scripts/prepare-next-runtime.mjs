import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cleanStagingPath,
  createCopyPlan,
  findStandaloneServer,
  verifyPreparedRuntime,
} from './next-runtime-layout.mjs';

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(desktopRoot, '../..');
const webRoot = path.join(repositoryRoot, 'apps', 'web');
const standaloneRoot = path.join(webRoot, '.next', 'standalone');
const runtimeRoot = path.join(desktopRoot, '.runtime');
const stagingRoot = path.join(runtimeRoot, 'web');
const serverPath = await findStandaloneServer(standaloneRoot);
const plan = createCopyPlan({
  standaloneRoot,
  serverPath,
  stagingRoot,
  publicSource: path.join(webRoot, 'public'),
  staticSource: path.join(webRoot, '.next', 'static'),
});

await cleanStagingPath(stagingRoot, runtimeRoot);
await mkdir(stagingRoot, { recursive: true });
await cp(plan.standaloneSource, plan.stagingRoot, { recursive: true, dereference: true });
await cp(plan.publicSource, plan.publicTarget, { recursive: true, dereference: true });
await cp(plan.staticSource, plan.staticTarget, { recursive: true, dereference: true });
const result = await verifyPreparedRuntime(plan);

console.log(`Prepared standalone server: ${plan.stagedServer}`);
console.log(`Prepared runtime: ${plan.stagingRoot}`);
console.log(`Runtime files: ${result.files}`);
console.log(`Runtime size: ${result.bytes} bytes`);
