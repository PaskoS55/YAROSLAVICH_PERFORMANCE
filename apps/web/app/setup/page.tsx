import { redirect } from "next/navigation";
import Image from "next/image";
import {
  PRODUCT_ASSETS,
  PRODUCT_IDENTITY,
} from "@pasko-performance/core/product";
import { prisma } from "../../lib/prisma";
import { SetupWizard } from "./setup-wizard";
import { getRuntimeLicenseState } from '../../lib/license-policy';
export default async function SetupPage() {
  if (getRuntimeLicenseState() !== 'VALID') redirect('/license');
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
    <main className="setup-shell">
      <div className="setup-card">
        <Image src={PRODUCT_ASSETS.logoLight} alt={PRODUCT_IDENTITY.display} width={300} height={100} className="mx-auto h-auto w-[240px]" priority />
        <div className="mt-6">
          <SetupWizard existing={{ organization: organization?.name, team: team?.name, season: season?.name }} />
        </div>
        <p className="mt-7 border-t border-gray-100 pt-4 text-center text-xs leading-5 text-gray-400">{PRODUCT_IDENTITY.creator.creditRu}</p>
      </div>
    </main>
  );
}
