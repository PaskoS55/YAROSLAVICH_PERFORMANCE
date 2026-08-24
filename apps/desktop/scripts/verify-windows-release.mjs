import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditAsarContents, auditForbiddenFileNames, auditRequiredPackagedRuntime, readReleaseIdentity, releasePaths, verifyReleaseOutputs } from './windows-release-layout.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const identity = await readReleaseIdentity(repositoryRoot);
const paths = releasePaths(repositoryRoot, identity);
await auditRequiredPackagedRuntime(paths, identity);
await auditForbiddenFileNames(paths.packagedRoot);
await auditAsarContents(path.join(paths.packagedRoot, 'resources', 'app.asar'));
const result = await verifyReleaseOutputs(paths, identity);
console.log(`Verified ${identity.artifactName}: ${result.sizeBytes} bytes, SHA-256 ${result.digest}`);
