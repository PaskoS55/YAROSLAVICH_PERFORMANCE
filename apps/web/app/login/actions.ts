'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { timingSafeEqual } from 'crypto';

// Timing-safe сравнение строк (защита от timing-атак)
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function login(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const expected = process.env.AUTH_PASSWORD;

  // Требуем AUTH_PASSWORD в env — без fallback
  if (!expected) {
    console.error('AUTH_PASSWORD not set in environment variables');
    redirect('/login?error=1');
  }

  if (safeCompare(password, expected)) {
    // Cookie содержит только флаг, не сам пароль
    const isProduction = process.env.NODE_ENV === 'production';
    cookies().set('yp_auth', 'authenticated', {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 дней
    });
    redirect('/');
  }
  redirect('/login?error=1');
}