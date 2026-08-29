import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireCurrentUser } from './current-user';
import { readDemoCapability, readSession } from './session';
import { DEMO_CAPABILITY_COOKIE, isDemoWorkspace } from './workspace';

// Demo uses the Club-issued, short-lived capability; it intentionally has no
// copy of the Club's LocalUser/password. Never query the production DB from Demo.
export async function requireReferenceActor(): Promise<string> {
  if (!isDemoWorkspace()) return (await requireCurrentUser()).id;
  const jar = await cookies();
  const session = await readSession(jar.get('yp_auth')?.value ?? '');
  const capability = await readDemoCapability(jar.get(DEMO_CAPABILITY_COOKIE)?.value ?? '');
  if (!session || !capability || session.userId !== capability.userId) redirect('/club-workspace');
  return session.userId;
}
