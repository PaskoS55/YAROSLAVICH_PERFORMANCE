import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('npm_execpath is required; start this script through npm');
const internalUrl = process.env.PASKO_PERFORMANCE_DESKTOP_DEV_URL || 'http://127.0.0.1:3000';
const children = new Set();
let stopping = false;

function start(args, extraEnv = {}) {
  const child = spawn(process.execPath, [npmCli, ...args], {
    cwd: root, env: { ...process.env, ...extraEnv }, stdio: 'inherit',
  });
  children.add(child); child.on('exit', () => children.delete(child)); return child;
}
function stop(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGTERM');
}
function shutdown(code = 0) {
  if (stopping) return; stopping = true;
  for (const child of children) stop(child);
  setTimeout(() => process.exit(code), 250);
}
async function waitForWeb(url, child) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next dev server exited with code ${child.exitCode}`);
    try { const response = await fetch(url, { redirect: 'manual' }); if (response.status < 500) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Next dev server did not become ready at ${url}`);
}
process.on('SIGINT', () => shutdown(130)); process.on('SIGTERM', () => shutdown(143));
const web = start(['run', 'dev', '--workspace', '@pasko-performance/web', '--', '--hostname', '127.0.0.1']);
try {
  await waitForWeb(internalUrl, web);
  const desktop = start(['run', 'dev', '--workspace', '@pasko-performance/desktop'], { PASKO_PERFORMANCE_DESKTOP_DEV_URL: internalUrl });
  desktop.on('exit', (code) => shutdown(code ?? 1)); web.on('exit', (code) => shutdown(code ?? 1));
} catch (error) { console.error(error instanceof Error ? error.message : error); shutdown(1); }
