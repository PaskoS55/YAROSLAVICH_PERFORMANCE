# PASKO recovery architecture

## Two backup classes

User Backup is an explicitly exported, portable JSON representation of supported business data. It is versioned and excludes LocalUser credentials, database credentials, session secrets, safeStorage payloads, installation secrets, plaintext passwords, and recovery keys.

Internal Recovery Snapshot is a PostgreSQL 16 custom-format archive created and retained locally by the packaged desktop main process. It is intended for same-installation disaster recovery and may contain sensitive database content, including LocalUser password hashes. It is never uploaded and is not a portable user backup.

## Pre-migration flow

Packaged migration directory names are compared with successful rows in `_prisma_migrations`. A fresh database needs no snapshot. A current database starts without `pg_dump`. If migrations are pending, the main process checks disk capacity, runs bundled `pg_dump -Fc` with the password only in `PGPASSWORD`, verifies the temporary archive with bundled `pg_restore --list`, calculates SHA-256, writes a non-secret manifest, and atomically publishes both files. Only then may `prisma migrate deploy` run.

The latest five verified internal snapshots are retained. Retention runs only after a new snapshot is published successfully. User backups are not part of this policy.

Migration or snapshot failure is fail-closed: Next does not start, the database is not reset or deleted, secrets are not regenerated, and the Recovery UI records bounded failure state without blind auto-restore.

## Restore safeguards

An internal archive must match its SHA-256 manifest, snapshot format, PostgreSQL major version, and Installation ID. A destructive restore must create a pre-restore safety snapshot when the current database can be read, stop application clients, restore with bundled PostgreSQL, apply pending migrations, bootstrap product references, and verify migrations, core tables, LocalUser presence, Organization/Team/Season consistency, and reference health before reporting success.

Normal Settings restore requires current local-administrator password re-entry and a typed confirmation. Startup recovery cannot safely verify that password when the database is unavailable; its destructive action must remain separately controlled and must never silently weaken authentication.

## Machine-secret limitation

An internal snapshot alone cannot move an installation to another Windows machine. safeStorage-bound machine secrets are separate from PostgreSQL data.

The current Recovery Key is for local password recovery only. **Recovery Key does not restore machine secrets.**

A future, separately approved PASKO Recovery Package would require explicit export, an independent strong passphrase/key, authenticated encryption, a versioned package, no plaintext secrets, clear sensitivity warnings, controlled recovery-only import, post-recovery rotation, license implications, and an audit trail. This phase does not implement that package.

## Diagnostics and privacy

The local diagnostics page reports product/runtime, database and migration state, snapshot manifests, reference health, and aggregate entity counts. The support ZIP contains redacted technical diagnostics and bounded logs. It excludes database dumps, player names and athlete records, cookies, authorization headers, passwords, recovery keys, database URLs, and machine secrets.
