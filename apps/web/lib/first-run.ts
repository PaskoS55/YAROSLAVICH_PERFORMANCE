import "server-only";
import { prisma } from "./prisma";
export type FirstRunState =
  | "NEEDS_ORGANIZATION"
  | "NEEDS_TEAM"
  | "NEEDS_SEASON"
  | "NEEDS_ADMIN"
  | "COMPLETE";
export async function resolveFirstRunState(): Promise<FirstRunState> {
  if (await prisma.localUser.count()) return "COMPLETE";
  const organization = await prisma.organization.findFirst({
    where: { deletedAt: null },
  });
  if (!organization) return "NEEDS_ORGANIZATION";
  const team = await prisma.team.findFirst({
    where: { organizationId: organization.id, deletedAt: null },
  });
  if (!team) return "NEEDS_TEAM";
  if (
    !(await prisma.season.findFirst({
      where: { deletedAt: null, teams: { some: { id: team.id } } },
    }))
  )
    return "NEEDS_SEASON";
  return "NEEDS_ADMIN";
}
