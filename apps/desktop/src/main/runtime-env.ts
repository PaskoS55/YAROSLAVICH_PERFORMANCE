const SECRET_KEYS = ['DATABASE_URL', 'AUTH_PASSWORD', 'AUTH_SESSION_SECRET'] as const;
export type NextRuntimeEnv = Record<string, string>;

export function buildNextRuntimeEnv(source: NodeJS.ProcessEnv, port: number): NextRuntimeEnv {
  const secrets = Object.fromEntries(SECRET_KEYS.map((key) => {
    const value = source[key];
    if (!value) throw new Error(`Required packaged runtime environment variable is missing: ${key}`);
    return [key, value];
  })) as Record<(typeof SECRET_KEYS)[number], string>;
  const windowsRuntime = Object.fromEntries(['SystemRoot', 'WINDIR'].flatMap((key) => source[key] ? [[key, source[key]]] : []));
  return { NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: String(port), APP_RUNTIME: 'desktop', ...windowsRuntime, ...secrets };
}

export function getSafeRuntimeEnvLog(env: NextRuntimeEnv): Record<string, string> {
  return { NODE_ENV: env.NODE_ENV, HOSTNAME: env.HOSTNAME, PORT: env.PORT, APP_RUNTIME: env.APP_RUNTIME };
}

export function redactRuntimeText(value: unknown, env: NextRuntimeEnv): string {
  let text = String(value);
  for (const key of SECRET_KEYS) text = text.split(env[key]).join('[REDACTED]');
  return text.replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, 'postgresql://[REDACTED]@').slice(0, 4000);
}
