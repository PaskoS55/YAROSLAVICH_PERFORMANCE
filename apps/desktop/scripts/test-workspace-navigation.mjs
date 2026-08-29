import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const electron = require('electron');
const args = process.argv.slice(2);
assert.ok(args.every(arg => ['--body-source-only','--metric-entry-only','--goal-scope-only','--mutation-only','--references-only','--auth-only'].includes(arg)), 'Unknown diagnostic option');
const childEnv = { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, TEMP: os.tmpdir(), TMP: os.tmpdir() };
if (process.env.PASKO_AUDIT_SCREENSHOT_DIR) childEnv.PASKO_AUDIT_SCREENSHOT_DIR = process.env.PASKO_AUDIT_SCREENSHOT_DIR;
const child = spawn(electron, [path.join(import.meta.dirname, 'test-workspace-navigation.cjs'), ...args], { windowsHide: true, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
child.stdout.on('data', data => { output += String(data); process.stdout.write(data); });
child.stderr.on('data', data => process.stderr.write(data));
const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
const root = output.match(/DISPOSABLE_ROOT=(.+)/)?.[1].trim();
if (root) {
  assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
  assert.ok(path.basename(root).startsWith('pasko-workspace-navigation-'));
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
process.exitCode = code === 0 && root ? 0 : 1;
