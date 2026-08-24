import { NextResponse } from 'next/server';
import { requireCurrentUser } from '../../../lib/current-user';
import { operationalLicenseRequired } from '../../../lib/license-policy';
import { createDemoCapability } from '../../../lib/session';
import { DEMO_CAPABILITY_COOKIE, productionWorkspaceRequired } from '../../../lib/workspace';

export async function GET(request: Request) {
  productionWorkspaceRequired(); operationalLicenseRequired();
  const user = await requireCurrentUser();
  const response = NextResponse.redirect(new URL('/demo-workspace', request.url));
  response.cookies.set(DEMO_CAPABILITY_COOKIE, await createDemoCapability(user.id), { httpOnly: true, sameSite: 'strict', secure: false, path: '/', maxAge: 30 * 60 });
  return response;
}
