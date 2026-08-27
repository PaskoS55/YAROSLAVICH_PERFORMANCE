import { NextResponse } from "next/server";

async function doLogout() {
  const res = new NextResponse(null, { status: 303, headers: { Location: '/login', 'Cache-Control': 'no-store' } });
  const isProduction =
    process.env.NODE_ENV === "production" &&
    process.env.APP_RUNTIME !== "desktop";
  res.cookies.delete({
    name: "yp_auth",
    path: "/",
    secure: isProduction,
  });
  res.cookies.delete({ name: 'pasko_demo_capability', path: '/', secure: isProduction });
  return res;
}

export async function POST() {
  return doLogout();
}

export async function GET() {
  return doLogout();
}
