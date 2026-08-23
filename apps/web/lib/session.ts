const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const DOMAIN = "PASKO_AUTH_SESSION_V1";
export interface SessionPayload {
  version: 1;
  userId: string;
  issuedAt: number;
  expiresAt: number;
}
function encode(value: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(value)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
function decode(value: string): string {
  const binary = atob(
    value
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(value.length / 4) * 4, "="),
  );
  return new TextDecoder().decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  );
}

async function getSecret(): Promise<string> {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET not set in environment variables");
  }
  return secret;
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${DOMAIN}\0${payload}`),
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSession(
  userId: string,
  now = Date.now(),
): Promise<string> {
  const payload = encode(
    JSON.stringify({
      version: 1,
      userId,
      issuedAt: now,
      expiresAt: now + SESSION_TTL_MS,
    }),
  );
  const secret = await getSecret();
  const hmac = await sign(payload, secret);
  return `${payload}.${hmac}`;
}

export async function readSession(
  token: string,
  now = Date.now(),
): Promise<SessionPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;
    const value = JSON.parse(decode(payload)) as SessionPayload;
    if (
      value.version !== 1 ||
      typeof value.userId !== "string" ||
      !Number.isFinite(value.issuedAt) ||
      !Number.isFinite(value.expiresAt) ||
      value.issuedAt > now ||
      value.expiresAt <= now ||
      value.expiresAt - value.issuedAt > SESSION_TTL_MS
    )
      return null;
    const secret = await getSecret();
    const expectedSig = await sign(payload, secret);
    if (signature.length !== expectedSig.length) return null;
    let mismatch = 0;
    for (let index = 0; index < signature.length; index += 1)
      mismatch |= signature.charCodeAt(index) ^ expectedSig.charCodeAt(index);
    return mismatch === 0 ? value : null;
  } catch {
    return null;
  }
}
export async function verifySession(token: string): Promise<boolean> {
  return (await readSession(token)) !== null;
}
