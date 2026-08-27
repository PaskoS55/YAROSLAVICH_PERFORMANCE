import type { WebContents } from 'electron';
import { classifyNavigation } from './url-policy';

type Decision = { action: 'allow' | 'block' | 'external' } | { action: 'switch'; url: string };

export function decideWindowNavigation(target: string, club: URL, demo?: URL): Decision {
  const clubDecision = classifyNavigation(target, club);
  const demoInternal = demo && classifyNavigation(target, demo) === 'internal';
  if (clubDecision !== 'internal' && !demoInternal) return { action: clubDecision === 'external' ? 'external' : 'block' };
  const url = new URL(target);
  if (demo && url.origin === club.origin && url.pathname === '/demo-workspace') return { action: 'switch', url: demo.href };
  if (demoInternal && url.pathname === '/club-workspace') return { action: 'switch', url: club.href };
  // Demo has no separate administrator. Expiry/logout always returns to club login.
  if (demoInternal && url.pathname === '/login') return { action: 'switch', url: new URL('/login', club).href };
  return { action: 'allow' };
}

export function installWindowNavigation(contents: WebContents, club: URL, demo: URL | undefined, openExternal: (url: string) => void): void {
  const navigate = (event: { url: string; preventDefault(): void }) => {
    const decision = decideWindowNavigation(event.url, club, demo);
    if (decision.action === 'allow') return;
    event.preventDefault();
    if (decision.action === 'external') openExternal(event.url);
    if (decision.action === 'switch') {
      // Finish processing the redirect (including Set-Cookie) before switching.
      setImmediate(() => {
        if (!contents.isDestroyed()) void contents.loadURL(decision.url).catch(() => console.error('Workspace navigation failed'));
      });
    }
  };
  contents.on('will-navigate', navigate);
  contents.on('will-redirect', navigate);
  contents.setWindowOpenHandler(({ url }) => {
    if (decideWindowNavigation(url, club, demo).action === 'external') openExternal(url);
    return { action: 'deny' };
  });
  contents.on('did-finish-load', () => {
    if (classifyNavigation(contents.getURL(), club) !== 'internal') return;
    const current = new URL(contents.getURL());
    if (current.origin === club.origin && current.pathname === '/login') contents.navigationHistory.clear();
  });
}
