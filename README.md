# PASKO PERFORMANCE PLATFORM — VOLLEYBALL

## Requirements

- Node.js 20.19 or newer
- npm 10 or newer
- Docker with Docker Compose, or PostgreSQL 16

## Clean setup

1. Copy `.env.example` to `.env`.
2. Replace `AUTH_PASSWORD` and set `AUTH_SESSION_SECRET` to at least 32 random characters.
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

Use a production PostgreSQL URL and supply unique production values for `AUTH_PASSWORD` and `AUTH_SESSION_SECRET`. Next.js sets `NODE_ENV` from the selected command; do not put it in `.env`. Deploy migrations with `npm run db:deploy` before `npm run start`. Do not run `prisma migrate dev` in production.

## Backup and restore

Create backups from Settings before migrations or destructive maintenance. Backup, restore, and reset are installation-wide administrative operations: they include or affect every organization and team. Restore accepts only version 3 backups produced by this application and validates their entity relationships before replacing data.

## Product and club context

- PASKO PERFORMANCE PLATFORM is the immutable product identity; VOLLEYBALL is its current sports vertical.
- Organization represents a club, Team represents a squad, and Season is the active working season.
- A signed HttpOnly context cookie selects the active Organization, Team, and Season. This context scopes data but is not user authorization.
- A database containing exactly one active Organization, Team, and linked Season uses a deterministic fallback. Multiple choices require explicit selection in the context screen.
- Product creator credit belongs to the product identity and cannot be overridden by organization branding.
- User/Role authorization, licensing, organization-scoped backup, cloud synchronization, and a complete first-run wizard are deferred to later phases.

## Product assets

Official product assets are immutable approved masters. Do not regenerate, redraw, distort, or modify their proportions. Organization assets are maintained separately from PASKO product branding and must never replace the product favicon or executable icon.
