const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 дней

async function getSecret(): Promise<string> {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error('AUTH_SESSION_SECRET not set in environment variables');
  }
  return secret;
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createSession(): Promise<string> {
  const exp = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = `${exp}`;
  const secret = await getSecret();
  const hmac = await sign(payload, secret);
  return `${payload}.${hmac}`;
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [payload, signature] = parts;
    const exp = parseInt(payload, 10);
    if (Number.isNaN(exp) || Date.now() > exp) return false;
    const secret = await getSecret();
    const expectedSig = await sign(payload, secret);
    return signature === expectedSig;
  } catch {
    return false;
  }
}