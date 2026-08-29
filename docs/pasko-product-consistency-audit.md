# Product consistency audit — in progress

Baseline: `be779d9f9ea0a7764ac93d1e50c582953912a77d`.

This is an evidence ledger, not a release acceptance report. Unexecuted checks
are NOT PASS. No new installer is approved by this document.

## Initial findings (before implementation)

| ID | Severity | Source | Reproduction / reason | Required correction |
| --- | --- | --- | --- | --- |
| B01 | BLOCKER | `apps/web/app/analytics/page.tsx`, category/team aggregation | Confirmed reference, historical published-distribution results: raw trend exists but empirical-only aggregation produces no profile scores. | Share reference coverage/scoring and confirmation with Player Details. |
| B02 | BLOCKER | `apps/web/app/compare/page.tsx`, `computePercentile` / `pctLabel` | Published-distribution measurements have a standardized score on Player Details but Compare reports only missing percentile evaluation. | Use the same metric compatibility/scoring; distinguish unsupported, incompatible and missing. |
| B03 | BLOCKER | `apps/web/app/api/export/route.ts`, team summary | Add a future or QC FAILED result: it can replace the historical PASSED latest value in the exported summary. | Historical cutoff and QC policy identical to source screens. |
| B04 | BLOCKER | `apps/web/app/body/page.tsx`, bodyCompositions ordering | Record a historical measurement after a recent measurement: createdAt ordering makes the old measurement current and reverses the trend. | Order by measurement date with deterministic tie-break. |
| B05 | BLOCKER | `apps/web/app/goals/actions.ts:syncGoals` vs `apps/web/lib/goals.ts:syncGoalsForResult` | An older result reaches a target while the latest does not: manual and automatic synchronization use different rules. | Define one achievement rule and reuse it transactionally. |
| B06 | BLOCKER — atomic fix verified; overall audit pending | `apps/web/app/body/actions.ts:createBodyComposition`; `apps/web/app/analytics/page.tsx` TestResult query | Existing BC_MASS=90; submit Body form mass=92. Former Body display was 92.0 kg while Dynamics remained 90. | Operator approved canonical TestResult; transactional projection and explicit non-destructive reconciliation implemented. |
| S01 | SHOULD FIX | `apps/web/app/body/actions.ts` | Invalid input returns silently; FFM greater than total mass is accepted; retries create duplicate measurements. | Explicit user-visible validation and idempotent measurement submission. |
| S02 | SHOULD FIX | date-only entry actions | Noon UTC conversion can make today's completed measurement future-dated before local afternoon. | Define calendar-date semantics and test time boundaries without admitting future measurements. |

These source findings still require executable regression evidence. Further
inventory, runtime reproduction, security review and mutation audit are pending.

## Accepted / deferred constraints

- Strength and mobility have no approved numeric reference: explanatory state,
  not fabricated scores. No new scientific norms.
- Licensing remains FROZEN / ENFORCEMENT OFF.
- Unsigned installer and documented dev/build dependency exception remain
  deferred; runtime dependency audit must still be clean.
- No production database changes, signing-key access or remote Git actions.

## Tracked route inventory

Derived from `git ls-files apps/web/app`, not sidebar navigation. `CLUB+DEMO`
means authenticated access in each isolated runtime, not anonymous access.
Inventory is complete; runtime coverage is still pending.

| Route | Class | Workflow |
| --- | --- | --- |
| `/` | CLUB+DEMO | Dashboard |
| `/analytics` | CLUB+DEMO | Player/test selection, historical dynamics, profile |
| `/dynamics` | CLUB+DEMO | Redirect alias to analytics |
| `/body` | CLUB+DEMO | Create measurement, latest/body trend |
| `/compare` | CLUB+DEMO | Two-player latest comparison |
| `/context` | CLUB+DEMO | Organization/team/season selection; Demo fixed context |
| `/equipment` | CLUB+DEMO | Equipment creation/editing |
| `/goals` | CLUB+DEMO | Create, synchronize, manually mark, filter goals |
| `/import` | CLUB; Demo forbidden | CSV import/preview/errors |
| `/license` | PUBLIC/system | Preserved activation route; enforcement frozen |
| `/login` | PUBLIC | Local sign-in |
| `/norms` | CLUB+DEMO | Select/confirm/clone/edit allowed reference profiles |
| `/players` | CLUB+DEMO | List/filter players |
| `/players/new` | CLUB+DEMO | Create player |
| `/players/[id]` | CLUB+DEMO | Profile, PB, history, goals, print |
| `/players/[id]/edit` | CLUB+DEMO | Edit/archive/restore player |
| `/protocols` | CLUB+DEMO | Test protocol browsing |
| `/qc` | CLUB+DEMO | Inspect/resolve QC flags |
| `/recover` | PUBLIC club; Demo forbidden | Local admin recovery |
| `/reports` | CLUB+DEMO | CSV report selection; export forbidden in Demo |
| `/sessions` | CLUB+DEMO | Session list, including future records |
| `/sessions/[id]` | CLUB+DEMO | Session/result editing |
| `/settings` | CLUB+DEMO | Club administration; restricted Demo reset page |
| `/settings/diagnostics` | CLUB; Demo forbidden | Diagnostics/support bundle |
| `/setup` | PUBLIC club; Demo forbidden | First-run setup, guarded by installation state |
| `/team` | CLUB+DEMO | Team roster/status/create |
| `/testing/team` | CLUB+DEMO | Batch test entry |
| `/tests` | CLUB+DEMO | Definitions/categories/archive filtering |
| `/tests/new` | CLUB+DEMO | Custom test definition |
| `/tests/[id]` | CLUB+DEMO | Edit/archive/restore definition |
| `/api/auth/logout` | PUBLIC GET/POST | Clear auth/Demo cookies; redirect login |
| `/api/backup` | CLUB; Demo forbidden | Installation-wide backup download |
| `/api/demo-enter` | Authenticated club | Mint Demo capability; desktop transition |
| `/api/diagnostics` | Authenticated/system | Runtime diagnostics |
| `/api/export` | CLUB; Demo forbidden | Team/player/session CSV |
| `/api/import-template` | CLUB; Demo forbidden | CSV template |
| `/api/restore` | CLUB; Demo forbidden | Validated transactional restore |
| `/api/support-bundle` | Authenticated/system | Sanitized support archive |
| root `layout.tsx` | Shared | Branding/context shell |
| `not-found.tsx` | Shared | Missing-resource page |

Desktop-only transitions `/demo-workspace` and `/club-workspace` are not Next
pages: the controlled BrowserWindow policy switches between the two exact
runtime origins. Other desktop workflows: single-instance focus, startup,
recovery, safe external HTTPS, shutdown, activation (retained but not required).

## Canonical metrics (16)

| Code | Category | Unit | Direction | QC range | Shipped reference |
| --- | --- | --- | --- | --- | --- |
| STR_PULL | STRENGTH | kg | HIGHER | 80–250 | NO_REFERENCE |
| STR_SQUAT | STRENGTH | kg | HIGHER | 60–220 | CONTEXT_ONLY |
| PWR_CMJ | POWER | cm | HIGHER | 20–80 | PUBLISHED_DISTRIBUTION |
| PWR_BJ | POWER | cm | HIGHER | 180–320 | NO_REFERENCE |
| SPD_10 | SPEED | sec | LOWER | 1.4–2.2 | PUBLISHED_DISTRIBUTION |
| SPD_20 | SPEED | sec | LOWER | 2.8–4 | PUBLISHED_DISTRIBUTION |
| AGI_TTEST | AGILITY | sec | LOWER | 8.5–12 | PUBLISHED_DISTRIBUTION |
| AGI_505 | AGILITY | sec | LOWER | 2–3.5 | NO_REFERENCE |
| VB_APP | VOLLEYBALL | cm | HIGHER | 280–370 | PUBLISHED_DISTRIBUTION, position/wildcard |
| VB_BLOCK | VOLLEYBALL | cm | HIGHER | 270–350 | PUBLISHED_DISTRIBUTION, position/wildcard |
| VB_SERVE | VOLLEYBALL | km/h | HIGHER | 70–140 | CONTEXT_ONLY |
| MOB_OHS | MOBILITY_STABILITY | score | CONTEXTUAL | 0–10 | CONTEXT_ONLY |
| MOB_SL | MOBILITY_STABILITY | score | CONTEXTUAL | 0–10 | CONTEXT_ONLY |
| BC_MASS | BODY_COMPOSITION | kg | CONTEXTUAL | 60–120 | CONTEXT_ONLY |
| BC_FAT | BODY_COMPOSITION | % | CONTEXTUAL | 5–25 | POOLED_ESTIMATE; not individual numeric score |
| BC_FFM | BODY_COMPOSITION | kg | CONTEXTUAL | 50–100 | CONTEXT_ONLY |

Demo seeds CMJ, both sprints, T-test, approach/block and the three body metrics.
No shipped EMPIRICAL_PERCENTILE entry; custom/legacy empirical interpolation
must still remain supported and independently tested.

## Executed checks during this cycle (not final acceptance)

- Shared latest/PB regression: every canonical metric, future/FAILED/deleted
  exclusion, deterministic equal-time ordering: PASS.
- Production standalone + actual Electron + disposable embedded PostgreSQL:
  D08 block 318→322.5, Player/Dynamics identical profile, Compare standardized
  score terminology: PASS.
- Equivalent synthetic Club/Demo fixture for all 16 metrics: historical latest,
  PB, trend, profile coverage, Compare and Goal current/status parity: PASS.
  This fixture supplies TestResult values directly; it does NOT establish
  consistency of separate Body form writes (B06 demonstrates the gap).
- Rendered route smoke: all 30 tracked pages inventoried; Club 90 checks,
  Demo 75 checks (five forbidden/system routes excluded), at 1366×768,
  1600×900, 1920×1080. No document overflow or detected render errors: PASS.
  This is not a screenshot review or an every-control mutation test.
- Body historical ordering after backfilled older row: PASS in the disposable
  fixture. Team CSV latest equals fixture values and excludes future: PASS.
- Demo→Club, Club→Demo, both logout flows, cookie clearing, protected direct
  access, Back clearing, exact origin restrictions: PASS.
- Full suite on the current source: 186/186 PASS (Desktop 69, Web 82, Core 13,
  DB 15, Issuer 7).
- Latest Web typecheck/lint: PASS. Current standalone Next build and runtime
  prepare/verify: PASS. Final release verification is still pending because B06
  is open; unit/build success does not override the failing UI integration.
- Initial test import path and CSV replaceAll TypeScript compatibility errors
  were exposed and corrected; their first runs were FAIL, not hidden PASS.
- `git diff --check`: PASS; Git emits LF→CRLF normalization warnings.
- **Body real form → Analytics current metric: FAIL**, actual result:
  `BODY SOURCE DIAGNOSTIC: real UI body mass=92; Analytics BC_MASS history=["90"]`.
  Reproducer: `node apps/desktop/scripts/test-workspace-navigation.mjs --body-source-only`.
  It creates and removes only its disposable synthetic PostgreSQL/Electron state.

## Accepted body-data decision and follow-up implementation

Operator confirmed: TestResult is the canonical BC_MASS/BC_FAT/BC_FFM measurement
source and treat BodyComposition as a synchronized projection carrying the
additional phase angle. New writes should be one transaction from either entry
workflow. Existing rows require explicit conflict handling: preserve both
original values, detect mismatches and require an operator decision; do not
silently overwrite historical data or guess from insertion timestamps.

Implemented with the existing exact `BodyComposition.testSessionId` link and
`TestResult(testSessionId,testId)` key; player/team/season are checked. No schema
migration. New Body/Team/Session/CSV writes project BC values in the same
transaction, under a session lock. Body retries also serialize on the player.
FFM stays directly entered. Existing conflicts block ordinary overwrite and are
shown separately; either explicit choice is transactional, version-checked and
recorded in AuditLog. No startup/reinstall reconciliation and no real DB touched.

Executed follow-up evidence:
- Body UI mass 92 / fat 15 / direct FFM 78.2 -> canonical results -> Dynamics: PASS.
- Sequential retries: one body snapshot, three BC results: PASS.
- Injected PostgreSQL write failure in each table: complete rollback: PASS.
- Legacy mismatch preserved on read/ordinary write; explicit TestResult and Body
  choices plus exactly two audit events: PASS.
- Server tests: forged context, wrong player link, stale decision and replay: PASS.
- Backup link + React Restore: Cancel, incorrect confirmation/password,
  malformed/version/FK rejection, insertion-failure rollback, full restoration
  of synchronized and unresolved BC values, unchanged LocalUser: PASS.
- Demo fresh/reset projections equal canonical BC values: PASS. Timeline
  legacy migration/reset/relaunch and production isolation: PASS.
- Full unit suite at this checkpoint: 203/203 PASS.

Additional findings while continuing the audit:
- B07: Restore preflight dereferenced JSON null/null rows and ignored a wrong
  product/sport declaration. Reproduced with four failing handler tests; minimal
  pre-transaction shape/identity/date validation added, all five tests now PASS.
- B08: packaged Reset still called unsupported `window.prompt`; actual Electron
  UI check failed to show a confirmation dialog. QC resolve and test archive
  shared that unsupported primitive. React confirmations implemented; Reset
  now also verifies the exact confirmation on the server. Repeated actual UI:
  Reset Cancel/wrong phrase/rollback/success, QC Cancel/resolve/downstream and
  test archive wrong/exact phrase all PASS.
- The all-metric entry harness initially failed on a wrong SQL column name in
  the test (`deletedAt` versus mapped `deleted_at`), then on a missing assumed
  progressive-form action field. These are exposed test-harness failures;
  neither is counted as product PASS. Replay now captures actual UI requests.
- B09 — OPEN, awaiting product decision: `PlayerGoal` has no season identity,
  while `syncGoalsForResult` reads only the selected season. Actual Electron/DB
  scenario: Season A CMJ=60, target=50, achieved=true; Season B has no results,
  displays the same achieved goal with current=missing; clicking “Проверить
  достижения” in B overwrites the global row to achieved=false. Reproducer:
  `node apps/desktop/scripts/test-workspace-navigation.mjs --goal-scope-only`.
  Required decision: cross-season player goal, or explicitly season-owned goal.
  No schema/legacy goal reassignment is performed without this decision.
- B10: full-table Restore comparison exposed changed `Team.updatedAt` after
  reconnecting seasons/active reference. Relation restoration now explicitly
  restores the backup timestamp; repeated full-table UI roundtrip PASS, including
  Backup -> Reset -> Restore and all 19 exported table/link collections.
- B11: CSV parser converted an empty result into 0 and omitted a first malformed
  data row as if it were a header. Explicit header detection, non-empty finite
  numeric validation and recoverable request errors added; seven parser tests
  PASS; real UI comma/empty/unknown-player/re-import/projection coverage PASS.
- All 16 metrics passed actual Team UI entry (comma decimals), nonnumeric
  rejection, exact DB storage, session retry and BC projection. Anonymous replay
  of a captured action through the public login route did not change data.
- Current complete unit suite: **216/216 PASS**. Web/Desktop typecheck, lint,
  Next production/standalone, PostgreSQL lifecycle, packaged Prisma/recovery,
  Demo/timeline and licensing-freeze checks PASS at this checkpoint.
- `npm audit --omit=dev`: 0 vulnerabilities. Repository tracked + nonignored
  candidate scan: 294 files, zero forbidden artifact paths, zero embedded private
  PEM blocks. This is not a final scan of a newly built installer.
- A parallel runtime prepare/read test launch failed on a temporarily missing
  Prisma DLL; corrected test ordering, not classified as an application failure.
- Final executed combined suite for this checkpoint exited 0: all-page rendered
  smoke (90 Club + 75 Demo viewport/page checks), all-metric cross-screen parity,
  Body writes/conflicts/rollback, complete Backup/Reset/Restore, QC, CSV, test
  archive, actual 16-metric entry, Demo/Club/logout/origin restrictions PASS.
- Scale smoke: 100 synthetic players / 400 sessions / 6400 results. Dashboard
  87 ms, Players 102 ms, Player Details 582 ms, Dynamics 506 ms, Compare 865 ms,
  Reports 118 ms on the audit host. Not a clean-Windows hardware benchmark.
- Branch remains `main...origin/main [ahead 7]`, HEAD unchanged at baseline.
  Worktree intentionally contains pending audit fixes; no commit/installer built
  while B09 is open. Dependencies, DB schema and licensing product configuration
  have no diff. Temporary integration clusters were stopped and removed.

## Cross-season goals decision and continued audit (2026-08-28)

B09 is CLOSED by the approved player-level cross-season rule. No `seasonId`
was added to PlayerGoal and no schema migration was introduced.
`goalMeasurements` supplies both displayed current value and recalculation:
owning team/player, PASSED, nondeleted, measurement <= now, all seasons, and
the shared DateTime/createdAt/id tie order. Inconsistent result/session player
links and nonfinite values are rejected. Automatic achievedAt is the earliest
qualifying measurement, not the click time. Existing incorrect automatic
timestamps are corrected on explicit recalculation; repeated recalculation of
the correct state performs no update. Invalidating the only qualifying result
can revoke an automatic achievement; merely switching seasons cannot.

The pre-existing explicitly manual trainer override remains: its date means the
operator's decision time, not a claimed test measurement. CONTEXTUAL goals remain
manual. Automatic recalculation of directional goals uses measurements, not that
override. This distinction does not introduce inferred seasonal ownership.

Executed evidence:
- 12/12 initial goal unit tests and Web typecheck PASS.
- Actual Electron + production standalone + disposable PG: Season A achieved;
  empty B displays identical current/status; B recalculation preserves achievedAt;
  future/FAILED B records do not achieve; valid B HIGHER/LOWER records achieve
  while A is selected; first satisfying A timestamp is retained: PASS.
- Same cross-season scenarios in Demo's fixed UI context with second-season
  synthetic measurements: PASS. Demo recalculation leaves Club goals unchanged.
- Full combined UI suite after this goal fix: all 16 metrics / Club-Demo parity,
  165 page-viewport checks, Body conflict actions, full Backup/Reset/Restore,
  QC, CSV, archive, navigation/logout and scale: PASS. Unit suite then 225/225.

Further findings (the audit did not stop at Goals):

| ID | Severity | Source / reproduced scenario | Correction / evidence |
| --- | --- | --- | --- |
| B12 | BLOCKER | `goals/actions.ts:createGoal`: identical UI submission twice creates two active goals. | Player-row transaction lock + identical active target/date lookup; immediate canonical cross-season synchronization. Actual retry UI PASS; blank/nonfinite/date validation and forged-team unit tests added. |
| S03 | SHOULD FIX | `team/actions.ts:createPlayer`: real form with HTML checks bypassed stored height=-1. | Shared Player server validation + visible error; repeated UI rejects invalid value and accepts 190. |
| B13 | BLOCKER | `settings/actions.ts:createSeason`: repeated identical form in pinned context creates duplicate seasons. | Shared `createSeasonOnce`, owning-team lock + same name/period lookup, also used by Context creation; strict calendar validation. Repeated real UI PASS. |
| B14 | BLOCKER | Dashboard recent sessions and Sessions list count a soft-deleted result; Session Details excludes it. Dashboard goals includes archived players while Goals excludes them. | Filter result counts and use identical active-player scope for goal count. Exact disposable fixture reproduced all three differences, then repeated UI PASS. Historical 31-day/future/deleted session deltas also verified. |
| B15 | BLOCKER | `norms/actions.ts:assignReferenceProfile` searches Club LocalUser inside Demo DB; real Demo confirmation navigates to Login. | `requireReferenceActor` validates existing matching signed session + Demo capability without a user copy/cross-DB access; Club still requires current LocalUser. Real UI confirmation + AuditLog + Club isolation PASS; 11 targeted authorization/reference tests PASS. |
| B16 | BLOCKER — CLOSED | `players/new/actions.ts:createPlayer`: replay of captured real auto-code form POST created a second player. | Form UUID + same-team transactional retry lookup and serialized code allocation; no schema change. Real captured POST replay now leaves exactly one player; 3 unit tests PASS. |

After B12/B13/S03, full unit suite was 240/240 PASS; Next build PASS. Lint
exited 0 with one test-harness unused-expression warning, subsequently corrected
to an explicit if/else; final lint rerun remains required.
One Dashboard fixture initially violated the session unique key by giving its
deleted and current rows the same timestamp/phase; corrected the fixture, then
the actual three counter defects were reproduced. This failed fixture run is
not counted as product verification.

## Release status

Final audit closure (2026-08-29): B12–B16 and S03 are CLOSED by real Electron/DB
regression. First Run, Login, Recovery rotation/password change, cookie invalidation,
Installation ID and exact domain-data preservation PASS. Unicode CSV downloads use
an ASCII fallback plus RFC 5987 UTF-8 filename and are injection-safe. Referenced
metric unit/direction/category identity is protected from silent reinterpretation;
no normative value was created or changed.

The final rendered run covered 30 tracked pages, 90 Club and 75 permitted Demo
viewport/page checks at 1366×768, 1600×900 and 1920×1080. Eight representative
real Electron captures were visually inspected; no clipping, overlap, radar-label
or horizontal-overflow defect remained. All 16 metrics and Player/Analytics/
Compare/Goals Club-Demo parity PASS. Disposable Backup → Reset → Restore compared
all 19 exported collections and retained LocalUser; malformed/version/FK/error
rollback PASS. Scale smoke used 100 players, 400 sessions and 6400 results with no
v1 performance blocker.

Final unit suites: 254/254 PASS (Desktop 69, Web 150, Core 13, DB 15, Issuer 7).
Prisma 5.22.0 format/validate/generate; Web/Desktop/Issuer typecheck; lint; Next
production/standalone; PostgreSQL/Prisma/recovery; Demo/timeline; licensing-freeze;
context isolation; installer build/verification; customer and Issuer key scans PASS.
Runtime npm audit: 0. Full audit remains the documented accepted build-toolchain
exception: 4 low, 22 high, 1 critical. Customer installer SHA-256:
`2bb5872138f1d48d965e6d5ded2c49bb8bc3cd87383ef4dfa1a84c7b959a7fa3`.

Accepted scientific limitation: Strength and Mobility/Stability have no approved
numeric coverage and remain outside the numeric radar while stored results/PB stay
visible. No norms were invented.

**BLOCKER = 0. LICENSING = FROZEN / ENFORCEMENT OFF.** No push, tag, release or
publish was performed.
