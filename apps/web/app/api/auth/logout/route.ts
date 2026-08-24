import { NextResponse } from "next/server";

async function doLogout(req: Request) {
  const res = NextResponse.redirect(new URL("/login", req.url), 303);
  const isProduction =
    process.env.NODE_ENV === "production" &&
    process.env.APP_RUNTIME !== "desktop";
  res.cookies.delete({
    name: "yp_auth",
    path: "/",
    secure: isProduction,
  });
  return res;
}

export async function POST(req: Request) {
  return doLogout(req);
}

export async function GET(req: Request) {
  return doLogout(req);
}
