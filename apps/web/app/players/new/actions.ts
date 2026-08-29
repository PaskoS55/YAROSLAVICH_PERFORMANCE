"use server";

import { prisma } from "../../../lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { validatePlayerFields } from "../../../lib/player";
import { requireAppContext } from "../../../lib/app-context";

export async function createPlayer(formData: FormData): Promise<void> {
  const context = await requireAppContext();
  const submissionId = String(formData.get("submissionId") ?? "");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      submissionId,
    )
  )
    redirect("/players/new?error=retry");
  const v = validatePlayerFields(formData);
  if (!v.ok) {
    redirect(`/players/new?error=${encodeURIComponent(v.error)}`);
  }
  const d = v.data as {
    lastName: string;
    firstName: string;
    middleName: string | null;
    playerIdInput: string;
    position: string;
    height: number | null;
    number: number | null;
    birthDate: Date | null;
    joinedDate: Date | null;
    comment: string | null;
  };

  let outcome: "created" | "duplicate" | "foreign";
  try {
    outcome = await prisma.$transaction(async (tx) => {
      // The form's UUID is an idempotency key, never an authorization source.
      // Serialize auto-code allocation on the current server-selected team.
      await tx.$queryRaw`SELECT id FROM teams WHERE id = ${context.teamId} FOR UPDATE`;
      const prior = await tx.player.findUnique({ where: { id: submissionId } });
      if (prior) return prior.teamId === context.teamId ? "created" : "foreign";
      let code = d.playerIdInput;
      if (!code) {
        let n =
          (await tx.player.count({ where: { teamId: context.teamId } })) + 1;
        code = `P${String(n).padStart(3, "0")}`;
        while (
          await tx.player.findFirst({
            where: { teamId: context.teamId, playerId: code },
          })
        ) {
          n += 1;
          code = `P${String(n).padStart(3, "0")}`;
        }
      } else {
        const dup = await tx.player.findUnique({
          where: {
            teamId_playerId: { teamId: context.teamId, playerId: code },
          },
        });
        if (dup) {
          return "duplicate";
        }
      }

      await tx.player.create({
        data: {
          id: submissionId,
          playerId: code,
          lastName: d.lastName,
          firstName: d.firstName,
          middleName: d.middleName,
          position: d.position,
          height: d.height,
          number: d.number,
          birthDate: d.birthDate,
          joinedDate: d.joinedDate,
          comment: d.comment,
          status: "ACTIVE",
          teamId: context.teamId,
        },
      });
      return "created";
    });
  } catch (error) {
    // A concurrent form with an explicitly selected duplicate code is recoverable.
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    )
      outcome = "duplicate";
    else throw error;
  }
  if (outcome !== "created") redirect(`/players/new?error=${outcome}`);

  revalidatePath("/players", "layout");
  revalidatePath("/team");
  revalidatePath("/", "layout");
  redirect("/players");
}
