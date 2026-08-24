"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  hashPassword,
  validatePassword,
  verifyPassword,
} from "../../lib/local-auth";
import { requireCurrentUser } from "../../lib/current-user";
import { prisma } from "../../lib/prisma";
export async function changePassword(formData: FormData) {
  const user = await requireCurrentUser();
  const current = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("newPassword") ?? "");
  if (!(await verifyPassword(current, user.passwordHash)))
    redirect("/settings?security=invalid-current");
  if (password !== String(formData.get("confirmPassword") ?? ""))
    redirect("/settings?security=mismatch");
  if (validatePassword(password)) redirect("/settings?security=policy");
  await prisma.localUser.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password) },
  });
  (await cookies()).delete("yp_auth");
  redirect("/login?password=changed");
}
