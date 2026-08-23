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
export interface SetupState {
  error?: string;
  recoveryKey?: string;
}
export async function completeSetup(
  _: SetupState,
  formData: FormData,
): Promise<SetupState> {
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
  const startDate = new Date(value("startDate"));
  const endDate = new Date(value("endDate"));
  if (!(startDate < endDate))
    return { error: "Дата окончания сезона должна быть позже даты начала." };
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
        if (!organization)
          organization = await tx.organization.create({
            data: {
              name: value("organizationName").trim(),
              shortName: value("organizationShortName").trim() || null,
              code: value("organizationCode").trim().toUpperCase(),
            },
          });
        let team = await tx.team.findFirst({
          where: { organizationId: organization.id, deletedAt: null },
          orderBy: { createdAt: "asc" },
        });
        if (!team)
          team = await tx.team.create({
            data: {
              organizationId: organization.id,
              name: value("teamName").trim(),
              code: value("teamCode").trim().toUpperCase(),
            },
          });
        const season = await tx.season.findFirst({
          where: { deletedAt: null, teams: { some: { id: team.id } } },
        });
        if (!season)
          await tx.season.create({
            data: {
              name: value("seasonName").trim(),
              startDate,
              endDate,
              teams: { connect: { id: team.id } },
            },
          });
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
    return {
      error:
        "Не удалось завершить настройку. Проверьте уникальность кодов и полей.",
    };
  }
  return { recoveryKey };
}
