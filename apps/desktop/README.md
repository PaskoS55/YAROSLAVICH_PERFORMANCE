# YAROSLAVICH PERFORMANCE Desktop — Phase 1

This workspace is a secure Electron shell for the existing Next.js application. Phase 1 is a development foundation, not a production installer. It does not package Next.js, PostgreSQL, Prisma migrations, first-run setup, updates, or production runtime services.

Run `npm run desktop:dev` from the repository root. One command starts the web workspace at `http://127.0.0.1:3000`, waits for it, compiles main and preload TypeScript, and starts Electron Forge. It uses the existing development `DATABASE_URL` and does not seed or reset it.

Set `YAROSLAVICH_DESKTOP_DEV_URL` to use another controlled HTTP(S) origin without credentials. Only that exact origin is allowed inside Electron. HTTPS external links open in the system browser; unsafe and arbitrary protocols are blocked.

Security defaults: Node integration off; context isolation, sandbox, and web security on; empty preload API; single-instance lock; DevTools enabled only by the development launcher.

Commands: `npm run desktop:build`, `npm run desktop:make`, and the workspace `typecheck`, `lint`, and `test:run` scripts. Squirrel configuration is prepared, but Phase 1 is not installer-ready.
