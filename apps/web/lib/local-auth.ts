import {
  createHash,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";
function scrypt(
  password: string,
  salt: Buffer,
  length: number,
  options: { N: number; r: number; p: number; maxmem: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    nodeScrypt(password, salt, length, options, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;

export function normalizeLogin(value: string): string {
  return value.trim().normalize("NFKC").toLocaleLowerCase("ru-RU");
}
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH)
    return `Пароль должен содержать не менее ${PASSWORD_MIN_LENGTH} символов.`;
  if (password.length > PASSWORD_MAX_LENGTH)
    return `Пароль должен содержать не более ${PASSWORD_MAX_LENGTH} символов.`;
  if (!password.trim()) return "Пароль не может состоять только из пробелов.";
  return null;
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 32, SCRYPT);
  return `scrypt$v1$N=${SCRYPT.N},r=${SCRYPT.r},p=${SCRYPT.p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}
export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  try {
    const [algorithm, version, parameters, saltText, keyText] =
      encoded.split("$");
    if (
      algorithm !== "scrypt" ||
      version !== "v1" ||
      parameters !== `N=${SCRYPT.N},r=${SCRYPT.r},p=${SCRYPT.p}`
    )
      return false;
    const expected = Buffer.from(keyText, "base64url");
    const actual = await scrypt(
      password,
      Buffer.from(saltText, "base64url"),
      expected.length,
      SCRYPT,
    );
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateRecoveryKey(): string {
  const bytes = randomBytes(20);
  const body = Array.from(
    bytes,
    (byte) => RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length],
  ).join("");
  return `PASKO-${body.match(/.{1,5}/g)!.join("-")}`;
}
export function hashRecoveryKey(key: string): string {
  return `sha256$v1$${createHash("sha256").update("PASKO_RECOVERY_V1\0").update(key.trim().toUpperCase()).digest("base64url")}`;
}
export function verifyRecoveryKey(key: string, encoded: string): boolean {
  const actual = Buffer.from(hashRecoveryKey(key));
  const expected = Buffer.from(encoded);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export const DUMMY_PASSWORD_HASH =
  "scrypt$v1$N=32768,r=8,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
