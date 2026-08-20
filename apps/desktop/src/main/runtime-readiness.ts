export interface ReadinessOptions {
  url: string; timeoutMs: number; intervalMs: number; hasExited: () => boolean;
  fetchImpl?: typeof fetch; sleep?: (milliseconds: number) => Promise<void>;
}
export async function waitForNextReadiness(options: ReadinessOptions): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const deadline = Date.now() + options.timeoutMs;
  while (Date.now() < deadline) {
    if (options.hasExited()) throw new Error('Next utility process exited before readiness');
    try { const response = await fetchImpl(options.url, { redirect: 'manual' }); if (response.status === 200) return; } catch {}
    await sleep(options.intervalMs);
  }
  if (options.hasExited()) throw new Error('Next utility process exited before readiness');
  throw new Error(`Next utility process readiness timed out after ${options.timeoutMs}ms`);
}
