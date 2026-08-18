import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from './lib/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Открытые пути: вход, auth-API и статические файлы
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    /\.(png|jpe?g|webp|svg|ico|css|js)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Проверяем подписанную сессию
  const token = request.cookies.get('yp_auth')?.value;
  if (!token || !(await verifySession(token))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
};