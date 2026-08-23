# PASKO PERFORMANCE PLATFORM — VOLLEYBALL

Developer architecture: [PASKO Reference profiles](docs/pasko-reference.md).

## Requirements

- Node.js 20.19 or newer
- npm 10 or newer
- Docker with Docker Compose, or PostgreSQL 16

## Clean setup

1. Copy `.env.example` to `.env`.
2. Set `AUTH_SESSION_SECRET` to at least 32 random characters for web development.
3. Start PostgreSQL:

   ```sh
   docker compose up -d postgres
   ```

4. Install the locked dependencies:

   ```sh
   npm ci
   ```

5. Apply committed migrations and generate Prisma Client:

   ```sh
   npm run db:deploy
   npm run --workspace @pasko-performance/db db:generate
   ```

6. Seed a new database once:

   ```sh
   npm run db:seed
   ```

7. Verify and start:

   ```sh
   npm run typecheck
   npm test
   npm run lint
   npm run build
   npm run dev
   ```

The application is available at `http://localhost:3000`.

## Production

For standalone web deployment, use a production PostgreSQL URL and a unique `AUTH_SESSION_SECRET`. Next.js sets `NODE_ENV` from the selected command; do not put it in `.env`. Deploy migrations with `npm run db:deploy` before `npm run start`. Do not run `prisma migrate dev` in production.

## Packaged desktop database

The packaged desktop startup is self-contained and ordered: bundled PostgreSQL 16.14 starts on dynamic loopback ports, packaged Prisma 5.22.0 runs only `migrate deploy`, the production Product + VOLLEYBALL reference catalogue is bootstrapped, and only then is the Next standalone runtime opened. A fresh database contains reference definitions but no Organization, Team, Season, Player, demo result, goal, or demo norm.

The packaged flow constructs its own database URL and does not require system Node, npm, Prisma, PostgreSQL, Docker, or Git. Web and desktop development continue to use explicit development database configuration.

Packaged Desktop creates an immutable random Installation ID and independent random database, session, and installation secrets. Electron protects them with Windows `safeStorage`; unavailable encryption, missing credentials beside an existing database, or decryption failure stops startup without plaintext fallback, reset, or regeneration. Next receives only the values it needs through a controlled child-process environment. A controlled Phase 5 upgrade can rotate legacy database credentials only when the legacy secret is explicitly supplied.

The First Run wizard guides a new installation through Club, Team, Season, Administrator, and explicit Recovery Key acknowledgement. Internal Organization and Team codes are generated uniquely on the server and are not normal setup fields. Passwords use salted, versioned Node.js scrypt hashes. The one-time Recovery Key is retained only as a domain-separated hash and resets the local administrator password; it cannot recover lost Windows safeStorage machine secrets. Backup v3 excludes LocalUser authentication hashes and every machine secret. Licensing, RBAC/cloud identity, machine-secret disaster recovery, and installer/release work remain deferred.

Settings provides synchronized native color pickers and canonical `#RRGGBB` inputs for optional Organization accents, with a live preview and reset to product defaults. Organization colors never alter the official PASKO visual brand, favicon, Windows icon, product names, or creator credit. The packaged production Electron window has no technical application menu; development retains its debugging menu and DevTools.

## Backup and restore

Create backups from Settings before migrations or destructive maintenance. Backup, restore, and reset are installation-wide administrative operations: they include or affect every organization and team. Restore accepts only version 3 backups produced by this application and validates their entity relationships before replacing data.

## Product and club context

- PASKO is the visual brand, PASKO Performance is the natural user-facing product name, PASKO PERFORMANCE PLATFORM is the official product identity, and VOLLEYBALL is its current sports vertical.
- Organization represents a club, Team represents a squad, and Season is the active working season.
- A signed HttpOnly context cookie selects the active Organization, Team, and Season. This context scopes data but is not user authorization.
- A database containing exactly one active Organization, Team, and linked Season uses a deterministic fallback. Multiple choices require explicit selection in the context screen.
- Product creator credit belongs to the product identity and cannot be overridden by organization branding.
- Licensing, full RBAC, organization-scoped backup, and cloud synchronization are deferred to later phases.

## Product assets

Official product assets are immutable approved masters. Do not regenerate, redraw, distort, or modify their proportions. Organization assets are maintained separately from PASKO product branding and must never replace the product favicon or executable icon.
