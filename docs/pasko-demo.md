# PASKO Demo Workspace and TRIAL

## Demo is not Trial

`TRIAL` is a valid signed license plan for real club work. A trial customer creates real organizations, teams, players, sessions and results in `pasko_performance`; replacing TRIAL with STANDARD, PRO or ENTERPRISE changes entitlements only and does not recreate First Run or business data.

PASKO Demo Workspace is a synthetic, resettable sandbox available only to an authenticated LocalUser on an installation whose verified license state is `VALID`. It is not a license mode, environment bypass or anonymous login path.

## Isolation

The club workspace uses PostgreSQL database `pasko_performance`. Demo uses the fixed database `pasko_performance_demo` in the same product-owned embedded PostgreSQL 16 cluster. Each local Next runtime receives one immutable `DATABASE_URL`; the renderer cannot provide a database name or connection string. No global connection URL is switched between requests.

Production login verifies the active LocalUser before issuing a short-lived, HMAC-signed Demo-only capability. The capability has a separate cryptographic domain, must match the normal signed session, and is not accepted by production mutations. Demo does not contain LocalUser password hashes.

User Backup, Restore, real import, production recovery, local security management and production diagnostics are blocked in Demo. Production backup and internal recovery operate only on `pasko_performance` and contain no Demo data. Demo initialization failure does not prevent the club workspace from starting.

## Dataset

- Code: `PASKO_DEMO_VOLLEYBALL_V1`
- Version: `1.0`
- Organization: `PASKO Demo Club`
- Team: `PASKO Demo Volleyball`
- Season: `2026/27`
- Roster: 14 fictional athletes (2 setters, 4 outside hitters, 3 middle blockers, 3 opposites, 2 liberos)
- Timeline: preseason, camp, start of season and current control
- Coverage: CMJ, 10/20 m sprint, T-test, attack/block reach and contextual body composition
- Stories: deliberate improvement, plateau, temporary decline/recovery, PB and achieved/active/approaching goals
- QC: one deliberate FAILED outlier with no score/PB contribution

All names and performance values are synthetic. The scientific profile `PASKO_VOLLEYBALL_MEN_ELITE_V1` is bootstrapped unchanged, including the CMJ literature distribution, position-specific volleyball reach references and contextual pooled body-composition estimates. No fake percentiles are manufactured.

## Lifecycle and reset

The Demo database is created after a valid licensed packaged startup, receives the same migrations and reference bootstrap, and then receives the versioned dataset. Initialization is idempotent. A future schema can either migrate this disposable database or recreate it from the current canonical dataset; production migration/recovery guarantees remain stronger.

“Сбросить демо-данные” requires the exact confirmation `СБРОСИТЬ ДЕМО`. Before destructive work, server code parses its own `DATABASE_URL` and requires the exact database name `pasko_performance_demo`; repeated reset additionally requires the trusted dataset marker. No database target is accepted from the browser. Reset never creates a production recovery snapshot.

## Future Presentation Capture Mode

The deterministic routes and dataset are intended for later capture of Dashboard, Players, Player profile, Testing, Analytics, Compare, PASKO Reference, Settings, License, Backup and Diagnostics concepts. Automated screenshots, commercial PDF/video capture and pre-First-Run anonymous Demo are deliberately deferred.
