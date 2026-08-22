import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from './prisma';
import { CONTEXT_COOKIE_NAME, verifyContextSelection } from './context-cookie';
import { resolveAppContext, type AppContextState, type ReadyAppContext } from './app-context-core';

export async function getAppContext(): Promise<AppContextState> {
  const token = (await cookies()).get(CONTEXT_COOKIE_NAME)?.value;
  let selection = null;
  if (token) {
    selection = await verifyContextSelection(token, process.env.AUTH_SESSION_SECRET ?? '');
    if (!selection) return { status: 'INVALID_CONTEXT' };
  }
  return resolveAppContext(prisma, selection);
}

export async function requireAppContext(): Promise<ReadyAppContext> {
  const context = await getAppContext();
  if (context.status !== 'READY') redirect(`/context?state=${context.status}`);
  return context;
}

export type { AppContextState, ReadyAppContext } from './app-context-core';
