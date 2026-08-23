import { redirect } from "next/navigation";
import Image from "next/image";
import {
  PRODUCT_ASSETS,
  PRODUCT_IDENTITY,
} from "@pasko-performance/core/product";
import { prisma } from "../../lib/prisma";
import { SetupForm } from "./setup-form";
export default async function SetupPage() {
  if (await prisma.localUser.count()) redirect("/login");
  const organization = await prisma.organization.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  const team = organization
    ? await prisma.team.findFirst({
        where: { organizationId: organization.id, deletedAt: null },
        orderBy: { createdAt: "asc" },
      })
    : null;
  const season = team
    ? await prisma.season.findFirst({
        where: { deletedAt: null, teams: { some: { id: team.id } } },
        orderBy: { startDate: "desc" },
      })
    : null;
  return (
    <main className="mx-auto min-h-screen max-w-2xl p-8">
      <Image
        src={PRODUCT_ASSETS.logoLight}
        alt={PRODUCT_IDENTITY.display}
        width={360}
        height={120}
      />
      <h1 className="mt-6 text-3xl font-bold">Добро пожаловать в PASKO</h1>
      <p className="mb-8 text-gray-500">{PRODUCT_IDENTITY.vertical}</p>
      <SetupForm
        existing={{
          organization: organization?.name,
          team: team?.name,
          season: season?.name,
        }}
      />
      <p className="mt-8 text-xs text-gray-400">
        {PRODUCT_IDENTITY.creator.creditRu}
      </p>
    </main>
  );
}
