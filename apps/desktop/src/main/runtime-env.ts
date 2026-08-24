const SECRET_KEYS = ["DATABASE_URL", "AUTH_SESSION_SECRET"] as const;
export type NextRuntimeEnv = Record<string, string>;

export function buildNextRuntimeEnv(
  source: NodeJS.ProcessEnv,
  port: number,
  databaseUrl = source.DATABASE_URL,
): NextRuntimeEnv {
  const secrets = Object.fromEntries(
    SECRET_KEYS.map((key) => {
      const value = key === "DATABASE_URL" ? databaseUrl : source[key];
      if (!value)
        throw new Error(
          `Required packaged runtime environment variable is missing: ${key}`,
        );
      return [key, value];
    }),
  ) as Record<(typeof SECRET_KEYS)[number], string>;
  const windowsRuntime = Object.fromEntries(
    ["SystemRoot", "WINDIR"].flatMap((key) =>
      source[key] ? [[key, source[key]]] : [],
    ),
  );
  return {
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
    APP_RUNTIME: "desktop",
    PASKO_INSTALLATION_ID: source.PASKO_INSTALLATION_ID ?? "",
    PASKO_PRODUCT_VERSION: source.PASKO_PRODUCT_VERSION ?? "",
    PASKO_RECOVERY_ROOT: source.PASKO_RECOVERY_ROOT ?? "",
    PASKO_LOGS_ROOT: source.PASKO_LOGS_ROOT ?? "",
    PASKO_LICENSE_STATE: source.PASKO_LICENSE_STATE ?? "UNLICENSED",
    PASKO_LICENSE_PAYLOAD: source.PASKO_LICENSE_PAYLOAD ?? "",
    PASKO_WORKSPACE: source.PASKO_WORKSPACE === "demo" ? "demo" : "club",
    PASKO_DEMO_DATASET_VERSION: source.PASKO_DEMO_DATASET_VERSION ?? "",
    PASKO_DEMO_AVAILABLE: source.PASKO_DEMO_AVAILABLE ?? "0",
    ...windowsRuntime,
    ...secrets,
  };
}

export function getSafeRuntimeEnvLog(
  env: NextRuntimeEnv,
): Record<string, string> {
  return {
    NODE_ENV: env.NODE_ENV,
    HOSTNAME: env.HOSTNAME,
    PORT: env.PORT,
    APP_RUNTIME: env.APP_RUNTIME,
  };
}

export function redactRuntimeText(value: unknown, env: NextRuntimeEnv): string {
  let text = String(value);
  for (const key of SECRET_KEYS) text = text.split(env[key]).join("[REDACTED]");
  return text
    .replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, "postgresql://[REDACTED]@")
    .replace(
      /((?:password|passwordHash|recoveryKey|recoveryKeyHash|databasePassword|authSessionSecret|installationSecret|encryptedPayload)\s*[=:]\s*)[^\s;,}]+/gi,
      "$1[REDACTED]",
    )
    .slice(0, 4000);
}
