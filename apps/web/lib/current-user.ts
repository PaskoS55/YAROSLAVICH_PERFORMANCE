import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { readSession } from "./session";
export async function requireCurrentUser() {
  const token = (await cookies()).get("yp_auth")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) redirect("/login");
  const user = await prisma.localUser.findUnique({
    where: { id: session.userId },
  });
  if (!user || user.disabledAt) redirect("/login");
  return user;
}
