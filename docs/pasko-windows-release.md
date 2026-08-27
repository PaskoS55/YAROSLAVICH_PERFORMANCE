# PASKO Performance — Windows release

## Supported platform

The v1.0 desktop release targets Windows 10 or newer on x64 hardware. The strict minimum is set by the bundled PostgreSQL 16 native runtime (Windows 10+) together with Electron 43.4.1. Windows 7/8/8.1 and 32-bit Windows are not release targets. PostgreSQL is application-private and is not installed as a Windows service.

The installer uses Electron Forge 7.11.2 with Squirrel.Windows as a per-user, no-admin installer. Application binaries are managed below the Windows user's LocalAppData Squirrel location. Persistent product state remains separately below `%LOCALAPPDATA%\PaskoPerformance`; each Windows account therefore has its own Installation ID, license state, production database, Demo database, logs, and recovery snapshots.

## Offline product model

The installer bundles Electron/Node, the Next.js 16.3.1 standalone server, Prisma 5.22, all migrations, and PostgreSQL 16.14 x64 (`bin`, `lib`, and `share`). System Node.js, npm, Prisma, PostgreSQL, Git, Docker, WSL, DNS, telemetry, or a cloud account are not required for normal operation.

PostgreSQL's Windows binaries depend on the Microsoft Visual C++ v14 runtime. To preserve the per-user, offline, no-admin installation model, the release pipeline app-locally deploys `vcruntime140.dll`, `vcruntime140_1.dll`, and `msvcp140.dll` beside the PostgreSQL executables. They are extracted during the build from Microsoft's official x64 Redistributable version 14.51.36247.0; the source executable, extraction tool, and each deployed DLL are pinned by SHA-256 in `apps/desktop/postgres-runtime.json`. The pipeline never copies runtime DLLs from the build machine, never downloads them at customer startup, and statically verifies the packaged PE dependency closure.

The same generic installer is used for every club. For v1.0 licensing enforcement is frozen OFF in product build configuration: no license file or mandatory activation is required. The offline signed-license architecture remains available for future re-enablement; see `pasko-licensing.md`. Customer data, activated licenses, test licenses, private signing keys, Installation IDs, and database clusters are forbidden in release artifacts.

Production data lives in `pasko_performance`. The isolated synthetic Demo Workspace lives in `pasko_performance_demo` and uses `PASKO_DEMO_VOLLEYBALL_V1` version 1.0. Production backups and recovery snapshots exclude Demo data. Demo reset accepts exactly `СБРОСИТЬ ДЕМО` and never accepts a renderer-controlled database target.

## Build and verification

### Accepted v1.0 build-chain security exception

The release owner approved this exception on 2026-08-27 for v1.0, based on source/lockfile baseline `53bc5eade77c62a8810e76db08b58f41ad9ea8c4`:

- `npm audit --omit=dev`: 0 vulnerabilities. Customer runtime dependencies are unaffected according to the current npm audit; this is not a claim that the whole product has no security risks.
- Full `npm audit`: FAIL, 4 low / 22 high / 1 critical; ACCEPTED BUILD-CHAIN SECURITY EXCEPTION, not an audit PASS.
- Affected area: build/dev tooling. The principal critical is `tar@6.2.1`, reached through Electron Forge 7.11.2 / `@electron/rebuild@3.7.2`, including its `@electron/node-gyp` and `make-fetch-happen` / `cacache` paths. Other affected tooling includes `extract-zip` and `tmp`.
- No confirmed compatible security backport exists for the current Forge toolchain. Remediation is scheduled post-v1.0 as a separate build-toolchain migration, including assessment of the Node baseline, Packager and Rebuild. No breaking migration or unsafe `tar` override is approved for this RC.
- Re-run both audits for every RC. Different counts, new advisories or customer/runtime findings require fresh review; this exception does not automatically accept them.

Mandatory v1.0 build mitigations:

1. Build only from the trusted repository and reviewed worktree.
2. Do not process untrusted archives or external build inputs; use only the approved, pinned build inputs.
3. Use the committed `package-lock.json` without changing the dependency tree.
4. Install with `npm ci`, not ad hoc dependency updates.
5. Use a trusted, protected build machine.
6. Inspect Git status/worktree before release and account for every change.
7. Verify the final installer SHA-256 after building.
8. Run repository and packaged-artifact private-key/security scans.
9. Never place production private keys in the repository or build tree.
10. Never use `npm audit fix --force` to satisfy this gate.

Licensing remains FROZEN / ENFORCEMENT OFF. This exception changes neither licensing nor application/security/database behavior, and does not waive the separate clean-Windows and signing RC gates below.

From a clean source tree on Windows x64:

```powershell
npm ci
npm run release:windows
npm run release:verify
```

The canonical output directory is `release/` and contains exactly:

- `PASKO-Performance-Volleyball-Setup-1.0.0.exe`
- `SHA256SUMS.txt`
- `release-manifest.json`

`release:windows` validates synchronized versions, builds and verifies Next standalone, prepares and verifies PostgreSQL (including the app-local Microsoft VC++ runtime and PE dependency closure) and Prisma, creates the Electron x64 package and Squirrel installer, rejects missing runtime files and forbidden artifact names, copies one canonical Setup executable, and writes its SHA-256 and machine-readable manifest. Generated release and Forge outputs are ignored by Git.

Verify a downloaded installer by calculating SHA-256 and comparing it with both `SHA256SUMS.txt` and `release-manifest.json`. Exact binary hashes can differ between separate builds because Squirrel embeds build timestamps; structure and version naming are deterministic, but bit-for-bit reproducibility is not claimed.

## Install, upgrade, reinstall, and uninstall

Squirrel installs per Windows user without requiring Administrator privileges. Setup creates Start Menu and Desktop shortcuts named `PASKO Performance`; both launch `PaskoPerformance.exe` without a console.

For v1 updates, the user receives a newer official Setup executable and installs it over the current version. The installer updates application files only. On the next launch the application owns database migration: PostgreSQL starts, a verified pre-migration snapshot is created only when migrations are pending, migrations and bootstrap run, and health checks complete. Failure enters Recovery Mode; it never resets or silently restores the production database.

Same-version reinstall and upgrade preserve `%LOCALAPPDATA%\PaskoPerformance`, including the Installation ID, license, LocalUser, production database, reference profiles, and recovery snapshots. Downgrade is unsupported; no automatic schema downgrade exists.

Default uninstall removes application binaries and shortcuts but deliberately preserves `%LOCALAPPDATA%\PaskoPerformance`. Reinstall therefore detects the existing Installation ID, license, database, and administrator and returns to Login rather than First Run. Full data removal is an advanced manual operation and is not implemented in the installer, avoiding an unsafe custom deletion path.

## Code signing and SmartScreen

The Phase 8 RC installer is unsigned. Windows SmartScreen and anti-malware products may warn about it. No self-signed certificate is presented as production trust, and no legal publisher identity is fabricated. Publisher metadata remains unresolved until a legal publishing entity and production Authenticode certificate are available.

The Forge/Squirrel configuration is ready to receive future signing parameters from an external protected build environment. A production release should sign both the main executable and Setup executable with a trusted Authenticode certificate and timestamp service. Certificates and private keys must never enter Git or the release directory.

## Validation status and remaining RC gates

Phase 8 uses a disposable guarded product root, a minimal `C:\Windows\System32;C:\Windows` PATH, externally generated TEST licenses, and the real installer/installed executable. This is a clean-machine-style substitute, not an actual clean VM. A final public v1.0 RC still requires installation on an external clean Windows 10/11 x64 machine or VM, an actual Windows reboot, SmartScreen/antivirus observation, and production Authenticode signing.

The installed application should be visually checked at 1366×768, 1600×900, and 1920×1080 for activation, First Run, Login, Dashboard, player/testing/analytics/reference/settings/Demo/Recovery workflows. No critical control may be clipped and no normal workflow may require horizontal scrolling.
