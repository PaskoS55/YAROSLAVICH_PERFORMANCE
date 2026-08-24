import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createReleaseManifest, readReleaseIdentity, releasePaths, sha256File, verifyReleaseOutputs } from '../scripts/windows-release-layout.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');

test('uses one synchronized canonical version and deterministic installer name', async () => {
  const identity = await readReleaseIdentity(repositoryRoot);
  assert.equal(identity.version, '1.0.0');
  assert.equal(identity.artifactName, 'PASKO-Performance-Volleyball-Setup-1.0.0.exe');
  const forge = (await import('../forge.config.cjs')).default;
  const squirrel = forge.makers.find((maker) => maker.name === '@electron-forge/maker-squirrel');
  assert.equal(forge.packagerConfig.appVersion, identity.version);
  assert.equal(forge.packagerConfig.executableName, 'PaskoPerformance');
  assert.equal(forge.packagerConfig.name, 'PASKO Performance');
  assert.equal(squirrel.config.setupExe, identity.artifactName);
  assert.equal(squirrel.config.noMsi, true);
  for (const forbidden of ['/.cache/postgres/archive.zip', '/src/main/index.ts', '/scripts/test-license-issuer.mjs']) {
    assert.ok(forge.packagerConfig.ignore.some((pattern) => pattern.test(forbidden)), `${forbidden} must be excluded from ASAR`);
  }
});

test('release manifest and checksum verification exercise actual artifact bytes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pasko-release-test-'));
  const identity = { version: '1.0.0', artifactName: 'PASKO-Performance-Volleyball-Setup-1.0.0.exe', product: { canonical: 'PASKO PERFORMANCE PLATFORM', shortProductName: 'PASKO Performance' } };
  const paths = releasePaths(root, identity);
  await mkdir(paths.releaseRoot, { recursive: true });
  await writeFile(paths.releaseArtifact, Buffer.from('synthetic installer bytes'));
  const digest = await sha256File(paths.releaseArtifact);
  const sizeBytes = (await readFile(paths.releaseArtifact)).length;
  await writeFile(paths.manifest, JSON.stringify(createReleaseManifest({ identity, artifactName: identity.artifactName, sizeBytes, sha256: digest, createdAt: '2026-08-24T00:00:00.000Z' })));
  await writeFile(paths.checksums, `${digest}  ${identity.artifactName}\n`);
  const result = await verifyReleaseOutputs(paths, identity);
  assert.equal(result.digest, digest);
  await writeFile(paths.releaseArtifact, Buffer.from('tampered installer bytes'));
  await assert.rejects(() => verifyReleaseOutputs(paths, identity), /metadata mismatch/);
});

test('Squirrel lifecycle creates and removes shortcuts without touching LocalAppData', async () => {
  const source = await readFile(path.join(repositoryRoot, 'apps/desktop/src/main/squirrel-startup.ts'), 'utf8');
  assert.match(source, /--createShortcut=/);
  assert.match(source, /--removeShortcut=/);
  assert.match(source, /windowsHide:\s*true/);
  assert.doesNotMatch(source, /LocalAppData|dataDirectoryName|rmSync|remove.*data/i);
});
