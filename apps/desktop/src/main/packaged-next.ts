import { existsSync } from 'node:fs';
import path from 'node:path';
import { utilityProcess, type UtilityProcess } from 'electron';
import { buildNextRuntimeEnv, getSafeRuntimeEnvLog, redactRuntimeText } from './runtime-env';
import { createIdempotentStopper } from './runtime-lifecycle';
import { findAvailableLoopbackPort } from './runtime-port';
import { waitForNextReadiness } from './runtime-readiness';

export interface PackagedNextRuntime { origin: URL; process: UtilityProcess; stop: () => boolean }
export async function startPackagedNext(serverPath: string): Promise<PackagedNextRuntime> {
  if (!existsSync(serverPath)) throw new Error('Packaged Next server.js is missing');
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const port = await findAvailableLoopbackPort();
    const origin = new URL(`http://127.0.0.1:${port}`);
    const env = buildNextRuntimeEnv(process.env, port);
    console.log('Starting packaged web runtime', getSafeRuntimeEnvLog(env));
    const child = utilityProcess.fork(serverPath, [], { cwd: path.dirname(serverPath), env, stdio: ['ignore', 'ignore', 'pipe'], serviceName: 'YAROSLAVICH Next Runtime' });
    let exited = false;
    let exitCode: number | null = null;
    let diagnostic = '';
    child.stderr?.on('data', (data: unknown) => { diagnostic = redactRuntimeText(`${diagnostic}${String(data)}`, env); });
    child.once('exit', (code) => { exited = true; exitCode = code; });
    const stop = createIdempotentStopper(() => child);
    try {
      await waitForNextReadiness({ url: new URL('/login', origin).toString(), timeoutMs: 25_000, intervalMs: 250, hasExited: () => exited });
      return { origin, process: child, stop };
    } catch (error) {
      lastError = exited ? new Error(`Next utility process exited with code ${exitCode}${diagnostic ? `: ${diagnostic}` : ''}`) : error;
      stop();
    }
  }
  throw new Error('Packaged Next runtime failed to become ready after 3 attempts', { cause: lastError });
}
