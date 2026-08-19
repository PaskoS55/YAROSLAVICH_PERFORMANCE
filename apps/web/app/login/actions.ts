'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { timingSafeEqual } from 'crypto';
import { createSession } from '../../lib/session';
import { prisma } from '../../lib/prisma';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;

async function loginClientIp(): Promise<string> {
  const requestHeaders = await headers();
  return (
    requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    requestHeaders.get('x-real-ip') ||
    'unknown'
  );
}

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
  const ipAddress = await loginClientIp();

  const recentFailures = await prisma.auditLog.count({
    where: {
      action: 'LOGIN_FAILED',
      entity: 'AUTH',
      entityId: ipAddress,
      createdAt: { gte: new Date(Date.now() - LOGIN_WINDOW_MS) },
    },
  });
  if (recentFailures >= LOGIN_MAX_FAILURES) {
    redirect('/login?error=rate-limit');
  }

  if (!expected) {
    console.error('AUTH_PASSWORD not set in environment variables');
    redirect('/login?error=1');
  }

  if (safeCompare(password, expected)) {
    const sessionToken = await createSession();
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieStore = await cookies();
    cookieStore.set('yp_auth', sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 дней
    });
    redirect('/');
  }

  await prisma.auditLog.create({
    data: {
      action: 'LOGIN_FAILED',
      entity: 'AUTH',
      entityId: ipAddress,
      ipAddress,
    },
  });
  redirect('/login?error=1');
}
