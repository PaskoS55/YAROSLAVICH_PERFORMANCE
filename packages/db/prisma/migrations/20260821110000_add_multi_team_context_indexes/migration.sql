DROP INDEX "teams_code_key";

CREATE UNIQUE INDEX "teams_organizationId_code_key" ON "teams"("organizationId", "code");
CREATE INDEX "teams_organizationId_deleted_at_idx" ON "teams"("organizationId", "deleted_at");
CREATE INDEX "players_teamId_deleted_at_idx" ON "players"("teamId", "deleted_at");
CREATE INDEX "test_sessions_teamId_seasonId_deleted_at_idx" ON "test_sessions"("teamId", "seasonId", "deleted_at");
CREATE INDEX "test_results_testSessionId_deleted_at_qcStatus_idx" ON "test_results"("testSessionId", "deleted_at", "qcStatus");
CREATE INDEX "test_results_playerId_deleted_at_qcStatus_idx" ON "test_results"("playerId", "deleted_at", "qcStatus");
CREATE INDEX "player_goals_playerId_deleted_at_idx" ON "player_goals"("playerId", "deleted_at");
CREATE INDEX "body_compositions_playerId_deleted_at_idx" ON "body_compositions"("playerId", "deleted_at");
CREATE INDEX "body_compositions_testSessionId_deleted_at_idx" ON "body_compositions"("testSessionId", "deleted_at");
