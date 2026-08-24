import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const desktopRoot = path.resolve(import.meta.dirname, '..');
const repositoryRoot = path.resolve(desktopRoot, '../..');
const webApp = path.join(repositoryRoot, 'apps/web/app');
const webBrand = path.join(repositoryRoot, 'apps/web/public/brand/pasko');
const windowsIcon = path.join(desktopRoot, 'assets/brand/PaskoPerformance.ico');

test('required canonical product assets exist', () => {
  for (const name of ['pasko-logo-on-light.png', 'pasko-logo-on-dark.png', 'pasko-performance-volleyball-master.png', 'pasko-mark-master.png']) {
    assert.equal(existsSync(path.join(webBrand, name)), true, name);
  }
  for (const name of ['favicon-16.png', 'favicon-32.png', 'favicon-48.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
    assert.equal(existsSync(path.join(webBrand, name)), true, name);
  }
});

test('Forge uses the official Windows icon and no club product icon', () => {
  assert.equal(existsSync(windowsIcon), true);
  const forgeConfig = readFileSync(path.join(desktopRoot, 'forge.config.cjs'), 'utf8');
  const metadata = readFileSync(path.join(webApp, 'layout.tsx'), 'utf8');
  assert.match(forgeConfig, /assets\/brand\/PaskoPerformance\.ico/);
  assert.match(forgeConfig, /setupIcon: windowsIcon/);
  assert.match(metadata, /\/brand\/pasko\/favicon-16\.png/);
  assert.match(metadata, /\/brand\/pasko\/apple-touch-icon\.png/);
  assert.doesNotMatch(`${forgeConfig}\n${metadata}`, /Yaroslavich|Ярославич|\/logo\.png/);
});
