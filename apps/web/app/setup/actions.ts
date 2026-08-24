"use server";
import { Prisma } from "@prisma/client";
import {
  hashPassword,
  generateRecoveryKey,
  hashRecoveryKey,
  normalizeLogin,
  validatePassword,
} from "../../lib/local-auth";
import { prisma } from "../../lib/prisma";
import { codeBase, uniqueCode } from "./setup-code";
import { operationalLicenseRequired } from '../../lib/license-policy';
export interface SetupState {
  error?: string;
  recoveryKey?: string;
  summary?: {
    organization: string;
    team: string;
    season: string;
    administrator: string;
  };
}
export async function completeSetup(
  _: SetupState,
  formData: FormData,
): Promise<SetupState> {
  operationalLicenseRequired();
  const value = (name: string) => String(formData.get(name) ?? "");
  const password = value("password");
  if (password !== value("confirmPassword"))
    return { error: "Пароли не совпадают." };
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };
  const displayName = value("displayName").trim();
  const login = value("login").trim();
  const loginNormalized = normalizeLogin(login);
  if (!displayName || !loginNormalized)
    return { error: "Заполните имя и логин администратора." };
  const organizationName = value("organizationName").trim();
  const teamName = value("teamName").trim();
  const seasonName = value("seasonName").trim();
  const startDate = new Date(`${value("startDate")}T12:00:00.000Z`);
  const endDate = new Date(`${value("endDate")}T12:00:00.000Z`);
  const recoveryKey = generateRecoveryKey();
  const passwordHash = await hashPassword(password);
  const recoveryKeyHash = hashRecoveryKey(recoveryKey);
  try {
    await prisma.$transaction(
      async (tx) => {
        if (await tx.localUser.count()) throw new Error("SETUP_COMPLETE");
        let organization = await tx.organization.findFirst({
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
        });
        if (!organization) {
          if (!organizationName) throw new Error("ORGANIZATION_REQUIRED");
          const base = codeBase(organizationName, "ORG");
          const code = await uniqueCode(base, async (candidate) =>
            Boolean(await tx.organization.findUnique({ where: { code: candidate }, select: { id: true } })),
          );
          organization = await tx.organization.create({
            data: {
              name: organizationName,
              shortName: value("organizationShortName").trim() || null,
              code,
            },
          });
        }
        let team = await tx.team.findFirst({
          where: { organizationId: organization.id, deletedAt: null },
          orderBy: { createdAt: "asc" },
        });
        if (!team) {
          if (!teamName) throw new Error("TEAM_REQUIRED");
          const base = codeBase(teamName, "TEAM");
          const code = await uniqueCode(base, async (candidate) =>
            Boolean(await tx.team.findUnique({
              where: { organizationId_code: { organizationId: organization.id, code: candidate } },
              select: { id: true },
            })),
          );
          team = await tx.team.create({
            data: {
              organizationId: organization.id,
              name: teamName,
              code,
            },
          });
        }
        const season = await tx.season.findFirst({
          where: { deletedAt: null, teams: { some: { id: team.id } } },
        });
        if (!season) {
          if (!seasonName) throw new Error("SEASON_REQUIRED");
          if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate)
            throw new Error("SEASON_DATES_INVALID");
          await tx.season.create({
            data: {
              name: value("seasonName").trim(),
              startDate,
              endDate,
              teams: { connect: { id: team.id } },
            },
          });
        }
        await tx.localUser.create({
          data: {
            displayName,
            login,
            loginNormalized,
            passwordHash,
            recoveryKeyHash,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "SETUP_COMPLETE")
      return { error: "Первоначальная настройка уже завершена." };
    if (error instanceof Error && error.message === "ORGANIZATION_REQUIRED") return { error: "Название клуба обязательно." };
    if (error instanceof Error && error.message === "TEAM_REQUIRED") return { error: "Название команды обязательно." };
    if (error instanceof Error && error.message === "SEASON_REQUIRED") return { error: "Название сезона обязательно." };
    if (error instanceof Error && error.message === "SEASON_DATES_INVALID") return { error: "Дата начала не может быть позже даты окончания." };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "Логин уже используется." };
    return { error: "Не удалось завершить настройку. Проверьте введённые данные." };
  }
  const [organization, team, season] = await Promise.all([
    prisma.organization.findFirst({ where: { deletedAt: null }, orderBy: { createdAt: "asc" }, select: { name: true } }),
    prisma.team.findFirst({ where: { deletedAt: null }, orderBy: { createdAt: "asc" }, select: { name: true } }),
    prisma.season.findFirst({ where: { deletedAt: null }, orderBy: { startDate: "desc" }, select: { name: true } }),
  ]);
  return { recoveryKey, summary: { organization: organization?.name ?? organizationName, team: team?.name ?? teamName, season: season?.name ?? seasonName, administrator: displayName } };
}
