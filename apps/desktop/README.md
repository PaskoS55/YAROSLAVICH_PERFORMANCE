# PASKO PERFORMANCE PLATFORM Desktop

This workspace is a secure Electron shell for the existing Next.js application. Phase 1 is a development foundation, not a production installer. It does not package Next.js, PostgreSQL, Prisma migrations, first-run setup, updates, or production runtime services.

Run `npm run desktop:dev` from the repository root. One command starts the web workspace at `http://127.0.0.1:3000`, waits for it, compiles main and preload TypeScript, and starts Electron Forge. It uses the existing development `DATABASE_URL` and does not seed or reset it.

Set `PASKO_PERFORMANCE_DESKTOP_DEV_URL` to use another controlled HTTP(S) origin without credentials. Only that exact origin is allowed inside Electron. HTTPS external links open in the system browser; unsafe and arbitrary protocols are blocked.

Security defaults: Node integration off; context isolation, sandbox, and web security on; empty preload API; single-instance lock; DevTools enabled only by the development launcher.

Commands: `npm run desktop:build`, `npm run desktop:make`, and the workspace `typecheck`, `lint`, and `test:run` scripts. Squirrel configuration is prepared, but Phase 1 is not installer-ready.

## Next.js standalone runtime

Run `npm run desktop:web:build` from the repository root. It builds the actual Next.js 16 standalone output, discovers the web `server.js`, recreates `apps/desktop/.runtime/web`, copies the complete traced runtime plus `public` and `.next/static` at the locations expected by that server, and verifies the artifact. The staging directory is generated and ignored by Git.

Phase 2 still uses the developer-installed Node.js to run this artifact. Electron process management and packaging a Node runtime belong to a later phase.

## Packaged runtime

Run `npm run desktop:package` to rebuild and verify the standalone web runtime, compile Electron, and create an unpacked Forge application. In packaged mode Electron starts `server.js` with `utilityProcess.fork`, waits for `/login` on a dynamically selected `127.0.0.1` port, and only then shows the BrowserWindow. The packaged runtime does not invoke `node`, npm, npx, or Next from `PATH`.

## Embedded PostgreSQL runtime (Phase 4)

The Windows package includes the complete EDB PostgreSQL 16.14 x64 binary archive as `resources/postgres`, outside ASAR. The pinned source and SHA-256 are recorded in `postgres-runtime.json`; EDB does not publish an independent checksum beside this ZIP, so the pinned digest was established from the initial trusted HTTPS download. No PostgreSQL installer or Windows service is used.

`npm run desktop:postgres:prepare` downloads to an ignored build cache when necessary, verifies the pinned SHA-256, extracts to a clean staging directory, and validates the complete runtime. `npm run desktop:postgres:verify` rechecks the staged distribution. `npm run desktop:postgres:test` creates only a disposable temporary cluster and verifies initdb, SCRAM authentication, a dynamic `127.0.0.1` listener, database creation, persistence, crash recovery, and fast shutdown using bundled executables.

Persistent application data is designed for `%LOCALAPPDATA%\PaskoPerformance\database\pg16`, with PostgreSQL logs under `%LOCALAPPDATA%\PaskoPerformance\logs\postgres`. The former `%LOCALAPPDATA%\YaroslavichPerformance` development path is detected only for diagnostics and is never moved, overwritten, or deleted automatically. Passwords are supplied by a controlled harness and are never stored in the repository, logged, or passed in argv. The Yaroslavich club logo remains an organization/demo asset and is separate from the official PASKO executable icon.
