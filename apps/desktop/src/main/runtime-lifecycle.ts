export interface KillableProcess { kill(): boolean }
export function createIdempotentStopper(getProcess: () => KillableProcess | null): () => boolean {
  let stopped = false;
  return () => {
    if (stopped) return false;
    stopped = true;
    return getProcess()?.kill() ?? false;
  };
}
