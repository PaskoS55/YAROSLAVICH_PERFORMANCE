import { spawn } from 'node:child_process';
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('npm_execpath is required; start this script through npm');
const child = spawn(process.execPath, [npmCli, 'exec', '--', 'electron-forge', 'start'], {
  env: { ...process.env, PASKO_PERFORMANCE_DESKTOP_DEV: '1' }, stdio: 'inherit',
});
child.on('error', (error) => { console.error('Unable to start Electron Forge:', error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { if (signal) process.kill(process.pid, signal); process.exitCode = code ?? 1; });
