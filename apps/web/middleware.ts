import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "./lib/session";
import { getRuntimeLicenseState } from './lib/license-policy';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const licensePublic = pathname.startsWith('/license') || pathname.startsWith('/login') || pathname.startsWith('/recover') || pathname.startsWith('/api/backup') || pathname.startsWith('/api/export') || pathname.startsWith('/api/restore') || pathname.startsWith('/api/diagnostics') || pathname.startsWith('/api/support-bundle') || pathname.startsWith('/settings/diagnostics') || pathname.startsWith('/api/auth');
  if (getRuntimeLicenseState() !== 'VALID' && !licensePublic && !/\.(png|jpe?g|webp|svg|ico|css|js)$/.test(pathname)) return NextResponse.redirect(new URL('/license', request.url));

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
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
