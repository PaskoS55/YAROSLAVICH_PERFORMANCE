'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { timingSafeEqual } from 'crypto';
import { createSession } from '../../lib/session';

// Timing-safe сравнение строк
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function login(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const expected = process.env.AUTH_PASSWORD;

  if (!expected) {
    console.error('AUTH_PASSWORD not set in environment variables');
    redirect('/login?error=1');
  }

  if (safeCompare(password, expected)) {
    const sessionToken = await createSession();
    const isProduction = process.env.NODE_ENV === 'production';
    cookies().set('yp_auth', sessionToken, {
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