"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSession } from "../../lib/session";
import {
  DUMMY_PASSWORD_HASH,
  normalizeLogin,
  verifyPassword,
} from "../../lib/local-auth";
import { prisma } from "../../lib/prisma";
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
export async function login(formData: FormData) {
  const loginNormalized = normalizeLogin(String(formData.get("login") ?? ""));
  const password = String(formData.get("password") ?? "");
  const user = await prisma.localUser.findUnique({
    where: { loginNormalized },
  });
  const now = new Date();
  if (user?.lockedUntil && user.lockedUntil > now) {
    await verifyPassword(password, user.passwordHash);
    redirect("/login?error=rate-limit");
  }
  const valid = await verifyPassword(
    password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  if (!user || user.disabledAt || !valid) {
    if (user) {
      const failures = user.failedLoginCount + 1;
      await prisma.localUser.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failures,
          lockedUntil:
            failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MS) : null,
        },
      });
    }
    redirect("/login?error=invalid");
  }
  await prisma.localUser.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
  });
  (await cookies()).set("yp_auth", await createSession(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.APP_RUNTIME !== "desktop",
    path: "/",
  });
  redirect("/");
}
