export const DEFAULT_INTERNAL_URL = 'http://127.0.0.1:3000';
export type NavigationDecision = 'internal' | 'external' | 'blocked';

export function getInternalUrl(value = process.env.PASKO_PERFORMANCE_DESKTOP_DEV_URL): URL {
  const candidate = new URL(value || DEFAULT_INTERNAL_URL);
  if (!['http:', 'https:'].includes(candidate.protocol) || candidate.username || candidate.password) {
    throw new Error('Desktop internal URL must be an HTTP(S) URL without credentials');
  }
  return candidate;
}

export function classifyNavigation(target: string, internalUrl: URL): NavigationDecision {
  let candidate: URL;
  try { candidate = new URL(target); } catch { return 'blocked'; }
  if (candidate.origin === internalUrl.origin) return 'internal';
  if (candidate.protocol === 'https:' && !candidate.username && !candidate.password) return 'external';
  return 'blocked';
}
