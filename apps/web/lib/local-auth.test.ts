import { describe, expect, it } from "vitest";
import {
  generateRecoveryKey,
  hashPassword,
  hashRecoveryKey,
  normalizeLogin,
  validatePassword,
  verifyPassword,
  verifyRecoveryKey,
} from "./local-auth";
describe("local authentication primitives", () => {
  it("normalizes login deterministically", () =>
    expect(normalizeLogin("  АдМин ")).toBe("админ"));
  it("enforces length without arbitrary complexity", () => {
    expect(validatePassword("короткий")).toBeTruthy();
    expect(validatePassword("длинная фраза с пробелами")).toBeNull();
  });
  it("uses salted scrypt hashes", async () => {
    const first = await hashPassword("correct horse battery");
    const second = await hashPassword("correct horse battery");
    expect(first).not.toBe(second);
    expect(await verifyPassword("correct horse battery", first)).toBe(true);
    expect(await verifyPassword("wrong password value", first)).toBe(false);
  });
  it("generates and verifies one-way recovery keys", () => {
    const key = generateRecoveryKey();
    const hash = hashRecoveryKey(key);
    expect(key).toMatch(/^PASKO-(?:[A-Z2-9]{5}-){3}[A-Z2-9]{5}$/);
    expect(hash).not.toContain(key);
    expect(verifyRecoveryKey(key, hash)).toBe(true);
    expect(verifyRecoveryKey(`${key}A`, hash)).toBe(false);
  });
});
