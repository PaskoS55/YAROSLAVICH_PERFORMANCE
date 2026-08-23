"use server";
import {
  hashPassword,
  generateRecoveryKey,
  hashRecoveryKey,
  normalizeLogin,
  validatePassword,
  verifyRecoveryKey,
} from "../../lib/local-auth";
import { prisma } from "../../lib/prisma";
export interface RecoveryState {
  error?: string;
  recoveryKey?: string;
}
const MAX = 5;
const LOCK_MS = 15 * 60 * 1000;
export async function recoverPassword(
  _: RecoveryState,
  formData: FormData,
): Promise<RecoveryState> {
  const loginNormalized = normalizeLogin(String(formData.get("login") ?? ""));
  const key = String(formData.get("recoveryKey") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirmPassword") ?? ""))
    return { error: "Пароли не совпадают." };
  const error = validatePassword(password);
  if (error) return { error };
  const user = await prisma.localUser.findUnique({
    where: { loginNormalized },
  });
  if (user?.recoveryLockedUntil && user.recoveryLockedUntil > new Date())
    return { error: "Слишком много попыток. Повторите позже." };
  const valid = user ? verifyRecoveryKey(key, user.recoveryKeyHash) : false;
  if (!user || !valid) {
    if (user) {
      const failures = user.failedRecoveryCount + 1;
      await prisma.localUser.update({
        where: { id: user.id },
        data: {
          failedRecoveryCount: failures,
          recoveryLockedUntil:
            failures >= MAX ? new Date(Date.now() + LOCK_MS) : null,
        },
      });
    }
    return { error: "Неверный логин или ключ восстановления." };
  }
  const recoveryKey = generateRecoveryKey();
  await prisma.localUser.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      recoveryKeyHash: hashRecoveryKey(recoveryKey),
      failedRecoveryCount: 0,
      recoveryLockedUntil: null,
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  return { recoveryKey };
}
