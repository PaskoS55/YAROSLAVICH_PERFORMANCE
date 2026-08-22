import { timingSafeEqual } from 'node:crypto';

const CONTEXT_DOMAIN = 'PASKO_APP_CONTEXT:v1:';
export const CONTEXT_COOKIE_NAME = 'pasko_context';
export const CONTEXT_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type ContextSelection = {
  organizationId: string;
  teamId: string;
  seasonId: string;
};

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${CONTEXT_DOMAIN}${payload}`));
  return Buffer.from(signature).toString('base64url');
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

export async function signContextSelection(selection: ContextSelection, secret: string): Promise<string> {
  if (!secret) throw new Error('Context signing secret is missing');
  const payload = encode(JSON.stringify(selection));
  return `${payload}.${await hmac(payload, secret)}`;
}

export async function verifyContextSelection(token: string, secret: string): Promise<ContextSelection | null> {
  try {
    if (!secret) return null;
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) return null;
    const expected = await hmac(payload, secret);
    const actualBytes = Buffer.from(signature, 'utf8');
    const expectedBytes = Buffer.from(expected, 'utf8');
    if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return null;
    const value = JSON.parse(decode(payload)) as Partial<ContextSelection>;
    if (!validId(value.organizationId) || !validId(value.teamId) || !validId(value.seasonId)) return null;
    return { organizationId: value.organizationId, teamId: value.teamId, seasonId: value.seasonId };
  } catch {
    return null;
  }
}

export function contextCookieSecure(): boolean {
  return process.env.NODE_ENV === 'production' && process.env.APP_RUNTIME !== 'desktop';
}
