import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Открытые пути: вход, auth-API и статические файлы (логотип и т.п.)
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    /\.(png|jpe?g|webp|svg|ico|css|js)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Проверяем наличие валидной сессии (не сам пароль, а флаг)
  const token = request.cookies.get('yp_auth')?.value;

  if (token !== 'authenticated') {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
};