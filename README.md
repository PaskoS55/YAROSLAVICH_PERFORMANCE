# YAROSLAVICH PERFORMANCE

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
   npm run --workspace @yaroslavich/db db:generate
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

Create backups from Settings before migrations or destructive maintenance. Restore accepts only version 3 backups produced by this application and validates their entity relationships before replacing data.
