import { app } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';

function runUpdate(args: string[]): void {
  const updateExecutable = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
  const child = spawn(updateExecutable, args, { detached: true });
  child.once('close', () => app.quit());
  child.once('error', () => app.quit());
}

export function handleSquirrelStartup(): boolean {
  if (process.platform !== 'win32') return false;

  const command = process.argv[1];
  const target = path.basename(process.execPath);
  if (command === '--squirrel-install' || command === '--squirrel-updated') {
    runUpdate([`--createShortcut=${target}`]);
    return true;
  }
  if (command === '--squirrel-uninstall') {
    runUpdate([`--removeShortcut=${target}`]);
    return true;
  }
  if (command === '--squirrel-obsolete') {
    app.quit();
    return true;
  }
  return false;
}
