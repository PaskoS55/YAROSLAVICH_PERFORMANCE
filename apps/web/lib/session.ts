import { createHmac } from 'crypto';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 дней

function getSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error('AUTH_SESSION_SECRET not set in environment variables');
  }
  return secret;
}

export function createSession(): string {
  const exp = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = `${exp}`;
  const hmac = createHmac('sha256', getSecret())
    .update(payload)
    .digest('hex');
  return `${payload}.${hmac}`;
}

export function verifySession(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [payload, signature] = parts;
    const exp = parseInt(payload, 10);
    if (Number.isNaN(exp)) return false;
    if (Date.now() > exp) return false; // Истёк

    const expectedSig = createHmac('sha256', getSecret())
      .update(payload)
      .digest('hex');
    if (signature !== expectedSig) return false; // Неверная подпись

    return true;
  } catch {
    return false;
  }
}