import { app } from 'electron';
import { spawn } from 'node:child_process';
import { resolveSquirrelLifecycle } from './squirrel-lifecycle';

const SQUIRREL_EVENT_TIMEOUT_MS = 15_000;

function runUpdate(executable: string, args: string[]): void {
  const child = spawn(executable, args, {
    windowsHide: true,
    stdio: 'ignore',
  });
  const timeout = setTimeout(() => app.quit(), SQUIRREL_EVENT_TIMEOUT_MS);
  const finish = (): void => {
    clearTimeout(timeout);
    app.quit();
  };
  child.once('close', finish);
  child.once('error', finish);
}

export function handleSquirrelStartup(): boolean {
  const plan = resolveSquirrelLifecycle(process.platform, process.argv, process.execPath);
  if (plan.kind === 'update') {
    runUpdate(plan.executable, plan.args);
    return true;
  }
  if (plan.kind === 'quit') {
    app.quit();
    return true;
  }
  return false;
}
