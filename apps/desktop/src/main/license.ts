import { createPublicKey, verify } from "node:crypto";
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
import type { SafeStorageAdapter } from "./installation-security";

export const LICENSE_FORMAT_VERSION = 1;
export const LICENSE_PRODUCT = "PASKO_PERFORMANCE_PLATFORM";
export const LICENSE_VERTICAL = "VOLLEYBALL";
export const MAX_LICENSE_BYTES = 64 * 1024;
export const CLOCK_ROLLBACK_TOLERANCE_MS = 24 * 60 * 60 * 1000;
export const PRODUCTION_LICENSE_KEYS: Readonly<Record<string, string>> = Object.freeze({
  PASKO_LICENSE_KEY_2026_01: `-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAVCcb4irw2fUttglm4Z3vnO5GP6QJgHBZger59nkf84s=\n-----END PUBLIC KEY-----\n`,
});

export type LicensePlan = "TRIAL" | "STANDARD" | "PRO" | "ENTERPRISE";
export type LicenseFeature = "VOLLEYBALL_CORE" | "REFERENCE_PROFILES" | "BACKUP_RECOVERY" | "ADVANCED_ANALYTICS" | "EXPORT";
export type LicenseState = "UNLICENSED" | "VALID" | "EXPIRED" | "INVALID" | "WRONG_INSTALLATION" | "NOT_YET_VALID" | "CLOCK_ROLLBACK_SUSPECTED";
export interface LicensePayload {
  formatVersion: 1;
  licenseId: string;
  keyId: string;
  product: typeof LICENSE_PRODUCT;
  vertical: typeof LICENSE_VERTICAL;
  customerName: string;
  organizationName?: string;
  installationId: string;
  issuedAt: string;
  notBefore: string;
  expiresAt: string | null;
  plan: LicensePlan;
  maxDevices: number;
  features: LicenseFeature[];
  issuer: "PASKO";
  signatureAlgorithm: "Ed25519";
}
export interface LicenseEnvelope { payload: LicensePayload; signature: string }
export interface LicenseEvaluation { state: LicenseState; payload: LicensePayload | null; message: string }

export function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
  }
  throw new Error("LICENSE_CANONICALIZATION_FAILED");
}

function parseInstant(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}

export function parseLicenseEnvelope(text: string): LicenseEnvelope {
  if (Buffer.byteLength(text, "utf8") > MAX_LICENSE_BYTES) throw new Error("LICENSE_FILE_TOO_LARGE");
  const value = JSON.parse(text) as Record<string, unknown>;
  if (!value || typeof value !== "object" || typeof value.signature !== "string" || !/^[A-Za-z0-9_-]{64,128}$/.test(value.signature) || !value.payload || typeof value.payload !== "object") throw new Error("LICENSE_FILE_MALFORMED");
  return value as unknown as LicenseEnvelope;
}

function payloadShapeValid(payload: LicensePayload): boolean {
  const plans: LicensePlan[] = ["TRIAL", "STANDARD", "PRO", "ENTERPRISE"];
  const features: LicenseFeature[] = ["VOLLEYBALL_CORE", "REFERENCE_PROFILES", "BACKUP_RECOVERY", "ADVANCED_ANALYTICS", "EXPORT"];
  return payload.formatVersion === LICENSE_FORMAT_VERSION && typeof payload.licenseId === "string" && payload.licenseId.length >= 8 && typeof payload.keyId === "string" && typeof payload.customerName === "string" && typeof payload.installationId === "string" && parseInstant(payload.issuedAt) !== null && parseInstant(payload.notBefore) !== null && (payload.expiresAt === null || parseInstant(payload.expiresAt) !== null) && plans.includes(payload.plan) && Number.isInteger(payload.maxDevices) && payload.maxDevices >= 1 && Array.isArray(payload.features) && payload.features.every((item) => features.includes(item)) && payload.issuer === "PASKO" && payload.signatureAlgorithm === "Ed25519";
}

export function evaluateLicense(input: { envelope: LicenseEnvelope; installationId: string; publicKeys?: Readonly<Record<string, string>>; now?: Date; lastKnownValidTime?: string | null }): LicenseEvaluation {
  const { payload } = input.envelope;
  const invalid = (message: string): LicenseEvaluation => ({ state: "INVALID", payload: null, message });
  if (!payloadShapeValid(payload)) return invalid("Формат лицензии не поддерживается.");
  const publicKey = (input.publicKeys ?? PRODUCTION_LICENSE_KEYS)[payload.keyId];
  if (!publicKey) return invalid("Ключ подписи лицензии не поддерживается.");
  try {
    const signature = Buffer.from(input.envelope.signature, "base64url");
    if (!verify(null, Buffer.from(canonicalize(payload), "utf8"), createPublicKey(publicKey), signature)) return invalid("Подпись лицензии не прошла проверку.");
  } catch { return invalid("Подпись лицензии не прошла проверку."); }
  if (payload.product !== LICENSE_PRODUCT) return invalid("Лицензия предназначена для другого продукта.");
  if (payload.vertical !== LICENSE_VERTICAL) return invalid("Лицензия предназначена для другого спортивного направления.");
  if (payload.installationId !== input.installationId) return { state: "WRONG_INSTALLATION", payload, message: "Лицензия не подходит для этой установки." };
  const now = (input.now ?? new Date()).getTime();
  const lastKnown = input.lastKnownValidTime ? parseInstant(input.lastKnownValidTime) : null;
  if (lastKnown !== null && now + CLOCK_ROLLBACK_TOLERANCE_MS < lastKnown) return { state: "CLOCK_ROLLBACK_SUSPECTED", payload, message: "Обнаружено существенное изменение системного времени." };
  if (now < Date.parse(payload.notBefore)) return { state: "NOT_YET_VALID", payload, message: "Срок действия лицензии ещё не начался." };
  if (payload.expiresAt && now >= Date.parse(payload.expiresAt)) return { state: "EXPIRED", payload, message: "Срок действия лицензии истёк." };
  return { state: "VALID", payload, message: "Лицензия активна." };
}

function atomicWrite(file: string, data: Buffer | string): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  let descriptor: number | undefined;
  try { descriptor = openSync(temporary, "wx", 0o600); writeFileSync(descriptor, data); fsyncSync(descriptor); closeSync(descriptor); descriptor = undefined; renameSync(temporary, file); }
  finally { if (descriptor !== undefined) closeSync(descriptor); rmSync(temporary, { force: true }); }
}

export class LicenseStore {
  readonly licensePath: string;
  readonly statePath: string;
  constructor(private readonly root: string, private readonly safeStorage: SafeStorageAdapter, private readonly publicKeys: Readonly<Record<string, string>> = PRODUCTION_LICENSE_KEYS) {
    this.licensePath = path.join(root, "license", "license.json");
    this.statePath = path.join(root, "license", "state.bin");
  }
  evaluate(installationId: string, now = new Date()): LicenseEvaluation {
    if (!existsSync(this.licensePath)) return { state: "UNLICENSED", payload: null, message: "Требуется активация лицензии." };
    try {
      let lastKnownValidTime: string | null = null;
      if (existsSync(this.statePath)) {
        if (!this.safeStorage.isEncryptionAvailable()) throw new Error("SAFE_STORAGE_UNAVAILABLE");
        lastKnownValidTime = (JSON.parse(this.safeStorage.decryptString(readFileSync(this.statePath))) as { lastKnownValidTime?: string }).lastKnownValidTime ?? null;
      }
      const result = evaluateLicense({ envelope: parseLicenseEnvelope(readFileSync(this.licensePath, "utf8")), installationId, publicKeys: this.publicKeys, now, lastKnownValidTime });
      if (result.state === "VALID") this.writeTrustedTime(now);
      return result;
    } catch { return { state: "INVALID", payload: null, message: "Хранилище лицензии повреждено или недоступно." }; }
  }
  activate(text: string, installationId: string, now = new Date()): LicenseEvaluation {
    const envelope = parseLicenseEnvelope(text);
    const result = evaluateLicense({ envelope, installationId, publicKeys: this.publicKeys, now });
    if (result.state !== "VALID") return result;
    atomicWrite(this.licensePath, `${JSON.stringify(envelope, null, 2)}\n`);
    this.writeTrustedTime(now);
    return result;
  }
  private writeTrustedTime(now: Date): void {
    if (!this.safeStorage.isEncryptionAvailable()) throw new Error("SAFE_STORAGE_UNAVAILABLE");
    atomicWrite(this.statePath, this.safeStorage.encryptString(JSON.stringify({ version: 1, lastKnownValidTime: now.toISOString() })));
  }
}
