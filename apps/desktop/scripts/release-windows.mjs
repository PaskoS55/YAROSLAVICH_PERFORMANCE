import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  auditForbiddenFileNames,
  auditAsarContents,
  auditRequiredPackagedRuntime,
  createReleaseManifest,
  readReleaseIdentity,
  releasePaths,
  sha256File,
  verifyReleaseOutputs,
} from './windows-release-layout.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const identity = await readReleaseIdentity(repositoryRoot);
const paths = releasePaths(repositoryRoot, identity);

function runNpm(args) {
  return new Promise((resolve, reject) => {
    const npmCli = process.env.npm_execpath;
    if (!npmCli) throw new Error('npm_execpath is required for the release pipeline');
    const child = spawn(process.execPath, [npmCli, ...args], {
      cwd: repositoryRoot,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`npm ${args.join(' ')} failed with exit code ${code}`)));
  });
}

if (path.resolve(paths.releaseRoot) !== path.resolve(repositoryRoot, 'release')) throw new Error('Unsafe release output path');
await rm(paths.releaseRoot, { recursive: true, force: true });
await runNpm(['run', 'desktop:web:build']);
await runNpm(['run', 'desktop:postgres:prepare']);
await runNpm(['run', 'desktop:postgres:verify']);
await runNpm(['run', 'desktop:prisma:prepare']);
await runNpm(['run', 'desktop:prisma:verify']);
await runNpm(['run', 'build', '--workspace', '@pasko-performance/desktop']);
await runNpm(['run', 'make', '--workspace', '@pasko-performance/desktop', '--', '--platform=win32', '--arch=x64']);

await auditRequiredPackagedRuntime(paths, identity);
await auditForbiddenFileNames(paths.packagedRoot);
await auditAsarContents(path.join(paths.packagedRoot, 'resources', 'app.asar'));
await stat(paths.makerArtifact);
await mkdir(paths.releaseRoot, { recursive: true });
await copyFile(paths.makerArtifact, paths.releaseArtifact);
const artifact = await stat(paths.releaseArtifact);
const sha256 = await sha256File(paths.releaseArtifact);
const manifest = createReleaseManifest({ identity, artifactName: identity.artifactName, sizeBytes: artifact.size, sha256 });
await writeFile(paths.manifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
await writeFile(paths.checksums, `${sha256}  ${identity.artifactName}\n`, 'utf8');
await verifyReleaseOutputs(paths, identity);
console.log(`Windows release ready: ${paths.releaseArtifact}`);
console.log(`SHA-256: ${sha256}`);
