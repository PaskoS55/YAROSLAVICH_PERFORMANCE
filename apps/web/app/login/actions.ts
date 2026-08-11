'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const expected = process.env.AUTH_PASSWORD ?? 'yaroslavich2026';

  if (password === expected) {
    cookies().set('yp_auth', expected, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    redirect('/');
  }
  redirect('/login?error=1');
}