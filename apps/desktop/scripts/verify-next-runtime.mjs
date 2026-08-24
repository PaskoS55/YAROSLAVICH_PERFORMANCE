import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCopyPlan, findStandaloneServer, verifyPreparedRuntime } from './next-runtime-layout.mjs';

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(desktopRoot, '../..');
const stagingRoot = path.join(desktopRoot, '.runtime', 'web');
const stagedServer = await findStandaloneServer(stagingRoot);
const plan = createCopyPlan({
  standaloneRoot: stagingRoot,
  serverPath: stagedServer,
  stagingRoot,
  publicSource: path.join(repositoryRoot, 'apps', 'web', 'public'),
  staticSource: path.join(repositoryRoot, 'apps', 'web', '.next', 'static'),
});
const result = await verifyPreparedRuntime(plan);

console.log(`Verified standalone server: ${plan.stagedServer}`);
console.log(`Verified runtime: ${plan.stagingRoot}`);
console.log(`Runtime files: ${result.files}`);
console.log(`Runtime size: ${result.bytes} bytes`);
