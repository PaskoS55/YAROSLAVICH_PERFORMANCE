import { randomBytes, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

export const INSTALLATION_STORE_VERSION = 1;

export interface SafeStorageAdapter {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

export interface InstallationSecrets {
  databaseBootstrapPassword: string;
  databasePassword: string;
  authSessionSecret: string;
  installationSecret: string;
}

export interface InstallationSecurity {
  installationId: string;
  createdAt: string;
  secrets: InstallationSecrets;
}

function randomSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function generateInstallationSecurity(
  now = new Date(),
): InstallationSecurity {
  return {
    installationId: randomUUID(),
    createdAt: now.toISOString(),
    secrets: {
      databaseBootstrapPassword: randomSecret(),
      databasePassword: randomSecret(),
      authSessionSecret: randomSecret(),
      installationSecret: randomSecret(),
    },
  };
}

function validate(value: unknown): InstallationSecurity {
  if (!value || typeof value !== "object")
    throw new Error("Installation secret payload is invalid");
  const record = value as Record<string, unknown>;
  const secrets = record.secrets as Record<string, unknown> | undefined;
  const required = [
    "databaseBootstrapPassword",
    "databasePassword",
    "authSessionSecret",
    "installationSecret",
  ];
  if (
    record.schemaVersion !== INSTALLATION_STORE_VERSION ||
    typeof record.installationId !== "string" ||
    typeof record.createdAt !== "string" ||
    !secrets ||
    required.some(
      (key) =>
        typeof secrets[key] !== "string" ||
        (secrets[key] as string).length < 40,
    )
  ) {
    throw new Error(
      "Installation secret payload has an unsupported or invalid format",
    );
  }
  return {
    installationId: record.installationId,
    createdAt: record.createdAt,
    secrets: secrets as unknown as InstallationSecrets,
  };
}

function atomicWrite(file: string, data: Buffer | string): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporary, "wx", 0o600);
    writeFileSync(descriptor, data);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    renameSync(temporary, file);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    rmSync(temporary, { force: true });
  }
}

export class InstallationSecurityStore {
  readonly metadataPath: string;
  readonly secretsPath: string;
  constructor(
    private readonly root: string,
    private readonly safeStorage: SafeStorageAdapter,
  ) {
    this.metadataPath = path.join(root, "security", "installation.json");
    this.secretsPath = path.join(root, "security", "secrets.bin");
  }

  exists(): boolean {
    return existsSync(this.metadataPath) || existsSync(this.secretsPath);
  }

  load(): InstallationSecurity {
    if (!this.safeStorage.isEncryptionAvailable())
      throw new Error("SAFE_STORAGE_UNAVAILABLE");
    if (!existsSync(this.metadataPath) || !existsSync(this.secretsPath))
      throw new Error("INSTALLATION_STORE_INCOMPLETE");
    try {
      const metadata = JSON.parse(
        readFileSync(this.metadataPath, "utf8"),
      ) as Record<string, unknown>;
      const payload = JSON.parse(
        this.safeStorage.decryptString(readFileSync(this.secretsPath)),
      ) as Record<string, unknown>;
      return validate({
        ...payload,
        installationId: metadata.installationId,
        createdAt: metadata.createdAt,
        schemaVersion: metadata.schemaVersion,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        ["SAFE_STORAGE_UNAVAILABLE", "INSTALLATION_STORE_INCOMPLETE"].includes(
          error.message,
        )
      )
        throw error;
      throw new Error("INSTALLATION_STORE_DECRYPT_FAILED", { cause: error });
    }
  }

  create(security = generateInstallationSecurity()): InstallationSecurity {
    if (!this.safeStorage.isEncryptionAvailable())
      throw new Error("SAFE_STORAGE_UNAVAILABLE");
    if (this.exists()) throw new Error("INSTALLATION_STORE_ALREADY_EXISTS");
    const payload = JSON.stringify({
      schemaVersion: INSTALLATION_STORE_VERSION,
      secrets: security.secrets,
    });
    atomicWrite(this.secretsPath, this.safeStorage.encryptString(payload));
    try {
      atomicWrite(
        this.metadataPath,
        JSON.stringify(
          {
            schemaVersion: INSTALLATION_STORE_VERSION,
            installationId: security.installationId,
            createdAt: security.createdAt,
          },
          null,
          2,
        ),
      );
    } catch (error) {
      rmSync(this.secretsPath, { force: true });
      throw error;
    }
    return security;
  }
}
