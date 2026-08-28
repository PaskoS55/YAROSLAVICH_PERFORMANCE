# Demo timeline v1

Dataset identity stays `PASKO_DEMO_VOLLEYBALL_V1` / `1.0`; temporal revision is independently versioned as `timelineVersion: 1` in `AuditLog.newValues` on `demo-dataset-identity`.

Creation and explicit Demo reset capture yesterday at 12:00 in the machine's local calendar. The anchor instant and initialization time are persisted as ISO timestamps. Four measurements use calendar offsets **-160, -135, -100, 0 days**. Season bounds are anchor -180 / +120 days; its ID is retained for existing AppContext links. Goal deadlines are +14 / +60 / +7 days; a seeded achieved goal has `achievedAt = anchor`. No completed measurement or achievement is future-dated at initialization.

Normal startup never moves an existing anchor. A clock rollback does not rewrite data; historical queries exclude measurements beyond the current request time.

An old, recognized dataset marker without `timelineVersion` triggers one transactional normalization on startup. Both the URL and the connected PostgreSQL database must be exactly `pasko_performance_demo`; organization/team identities are checked. Only the known synthetic session dates, synthetic goal deadlines/achievement dates, the linked Demo season metadata and the dataset marker change. Missing/deleted synthetic records are not recreated. IDs, values, player edits, extra records and LocalUser are preserved. Unknown marker versions fail closed. No production connection, First Run, schema migration or reset is needed. Explicit Demo reset remains the separate, user-confirmed reset workflow and creates a fresh anchor.

Dashboard counts use the closed interval `[now - 30 days, now]`. Current Player Profile/PB, analytics, comparison, body measurements, reports and automatic goal evaluation restrict session dates to `<= now`. Session editing/listing is not filtered: this change does not delete or conceal future records in their management workflow.
