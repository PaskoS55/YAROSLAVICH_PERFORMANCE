import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readDemoCapability, readSession, verifySession } from "./lib/session";
import { DEMO_CAPABILITY_COOKIE } from './lib/workspace';
import { operationalLicenseAllowed } from './lib/license-policy';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const demo = process.env.PASKO_WORKSPACE === 'demo';
  const demoBlocked = pathname.startsWith('/api/backup') || pathname.startsWith('/api/restore') || pathname.startsWith('/api/export') || pathname.startsWith('/api/import') || pathname.startsWith('/import') || pathname.startsWith('/recover') || pathname.startsWith('/setup') || pathname.startsWith('/settings/diagnostics');
  if (demo && demoBlocked) return NextResponse.json({ error: 'Операция недоступна в демонстрационном пространстве.' }, { status: 403 });
  const licensePublic = pathname.startsWith('/license') || pathname.startsWith('/login') || pathname.startsWith('/recover') || pathname.startsWith('/api/backup') || pathname.startsWith('/api/export') || pathname.startsWith('/api/restore') || pathname.startsWith('/api/diagnostics') || pathname.startsWith('/api/support-bundle') || pathname.startsWith('/settings/diagnostics') || pathname.startsWith('/api/auth');
  if (!operationalLicenseAllowed() && !licensePublic && !/\.(png|jpe?g|webp|svg|ico|css|js)$/.test(pathname)) return NextResponse.redirect(new URL('/license', request.url));

  // Открытые пути: вход, auth-API и статические файлы
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/setup") ||
    pathname.startsWith("/recover") ||
    pathname.startsWith("/license") ||
    pathname.startsWith("/api/auth") ||
    /\.(png|jpe?g|webp|svg|ico|css|js)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Проверяем подписанную сессию
  const token = request.cookies.get("yp_auth")?.value;
  if (!token || !(await verifySession(token))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (demo) {
    const session = await readSession(token);
    const capabilityToken = request.cookies.get(DEMO_CAPABILITY_COOKIE)?.value;
    const capability = capabilityToken ? await readDemoCapability(capabilityToken) : null;
    if (!session || !capability || capability.userId !== session.userId) return NextResponse.redirect(new URL('/club-workspace', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
