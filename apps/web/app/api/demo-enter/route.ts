import { NextResponse } from 'next/server';
import { requireCurrentUser } from '../../../lib/current-user';
import { operationalLicenseRequired } from '../../../lib/license-policy';
import { createDemoCapability } from '../../../lib/session';
import { DEMO_CAPABILITY_COOKIE, productionWorkspaceRequired } from '../../../lib/workspace';

export async function GET() {
  productionWorkspaceRequired(); operationalLicenseRequired();
  const user = await requireCurrentUser();
  // Standalone Next may reconstruct request.url with localhost instead of the
  // BrowserWindow's 127.0.0.1 origin. Keep the redirect on the actual host.
  const response = new NextResponse(null, { status: 307, headers: { Location: '/demo-workspace', 'Cache-Control': 'no-store' } });
  response.cookies.set(DEMO_CAPABILITY_COOKIE, await createDemoCapability(user.id), { httpOnly: true, sameSite: 'strict', secure: false, path: '/', maxAge: 30 * 60 });
  return response;
}
