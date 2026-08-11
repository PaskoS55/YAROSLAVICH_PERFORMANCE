import { NextResponse } from 'next/server';

async function doLogout(req: Request) {
  const res = NextResponse.redirect(new URL('/login', req.url), 303);
  res.cookies.delete('yp_auth');
  return res;
}

export async function POST(req: Request) {
  return doLogout(req);
}

export async function GET(req: Request) {
  return doLogout(req);
}