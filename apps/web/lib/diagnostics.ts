import 'server-only';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from './prisma';
import { redactSupportText } from './support-bundle';
import { getRuntimeLicenseState, readLicenseMetadata } from './license-policy';
import { runtimeProductVersion } from './product-version';

type Snapshot = { snapshotFormatVersion: number; snapshotId: string; createdAt: string; reason: string; productVersion: string; postgresMajor: string; schemaMigrationNames: string[]; targetMigrationSet: string[]; installationId: string; databaseFileChecksum: string; sizeBytes: number };

async function readSnapshots(): Promise<Snapshot[]> {
  const root = process.env.PASKO_RECOVERY_ROOT;
  if (!root) return [];
  const directory = path.join(path.resolve(root), 'manifests');
  try {
    const names = (await readdir(directory)).filter((name) => /^[0-9a-f-]{36}\.json$/.test(name));
    return (await Promise.all(names.map(async (name) => JSON.parse(await readFile(path.join(directory, name), 'utf8')) as Snapshot))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch { return []; }
}

async function readStartupStatus() {
  const root = process.env.PASKO_RECOVERY_ROOT;
  if (!root) return null;
  try { return JSON.parse(await readFile(path.join(path.resolve(root), 'status.json'), 'utf8')) as Record<string, unknown>; }
  catch { return null; }
}

export async function collectDiagnostics() {
  const licenseMetadata = readLicenseMetadata();
  const [migrationRows, counts, references, snapshots, startupStatus] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>>('SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at'),
    Promise.all([prisma.organization.count(), prisma.team.count(), prisma.season.count(), prisma.player.count()]),
    prisma.normProfile.count({ where: { code: 'PASKO_VOLLEYBALL_MEN_ELITE_V1', scope: 'SYSTEM', status: 'ACTIVE', deletedAt: null } }),
    readSnapshots(), readStartupStatus(),
  ]);
  const failed = migrationRows.filter((row) => row.finished_at === null && row.rolled_back_at === null);
  const successful = migrationRows.filter((row) => row.finished_at !== null && row.rolled_back_at === null);
  return {
    product: 'PASKO PERFORMANCE PLATFORM', productVersion: runtimeProductVersion(), sportVertical: 'VOLLEYBALL',
    installationId: process.env.PASKO_INSTALLATION_ID || null, appRuntime: process.env.APP_RUNTIME || 'web', databaseStatus: failed.length ? 'FAILED_MIGRATION' : 'HEALTHY', postgresMajor: '16',
    currentMigration: successful.at(-1)?.migration_name ?? null, appliedMigrations: successful.map((row) => row.migration_name), failedMigrations: failed.map((row) => row.migration_name),
    snapshotCount: snapshots.length, snapshotStorageSize: snapshots.reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0), lastSnapshot: snapshots[0] ?? null, snapshots,
    lastStartupStatus: startupStatus, referenceProfileStatus: references === 1 ? 'HEALTHY' : 'MISSING_OR_DUPLICATE',
    license: { state: getRuntimeLicenseState(), licenseId: licenseMetadata?.licenseId ?? null, keyId: licenseMetadata?.keyId ?? null, plan: licenseMetadata?.plan ?? null, expiresAt: licenseMetadata?.expiresAt ?? null, product: licenseMetadata?.product ?? null, vertical: licenseMetadata?.vertical ?? null },
    counts: { organizations: counts[0], teams: counts[1], seasons: counts[2], players: counts[3] },
  };
}

export async function collectRedactedLogs(): Promise<string> {
  const root = process.env.PASKO_LOGS_ROOT;
  if (!root) return '';
  try {
    const resolved = path.resolve(root);
    const files = (await readdir(resolved)).filter((name) => name.endsWith('.log')).slice(-5);
    const chunks: string[] = [];
    for (const name of files) {
      const file = path.join(resolved, name);
      if ((await stat(file)).size > 2 * 1024 * 1024) continue;
      chunks.push(`--- ${name} ---\n${redactSupportText(await readFile(file, 'utf8')).slice(-200_000)}`);
    }
    return chunks.join('\n');
  } catch { return ''; }
}
