-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'CONTEXTUAL');

-- CreateEnum
CREATE TYPE "ChangeStatus" AS ENUM ('SIGNIFICANT_IMPROVEMENT', 'SIGNIFICANT_DECREASE', 'MINOR_CHANGE', 'NO_CHANGE', 'THRESHOLD_NOT_CONFIGURED');

-- CreateEnum
CREATE TYPE "QCStatus" AS ENUM ('PASSED', 'FAILED', 'NOT_CHECKED');

-- CreateEnum
CREATE TYPE "SessionPhase" AS ENUM ('PRESEASON', 'CAMP', 'INSEASON', 'POSTSEASON', 'RECOVERY');

-- CreateEnum
CREATE TYPE "PlayerStatus" AS ENUM ('ACTIVE', 'INJURED', 'LIMITED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('FULL', 'PARTIAL', 'INCOMPLETE', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "SessionSource" AS ENUM ('MANUAL', 'MEDASS', 'TENSOR_PLATFORM', 'PHOTO_CELLS', 'CSV', 'API', 'OTHER');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "middleName" TEXT,
    "number" INTEGER,
    "position" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "height" INTEGER,
    "status" "PlayerStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedDate" TIMESTAMP(3),
    "photoUrl" TEXT,
    "comment" TEXT,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "includeInRadar" BOOLEAN NOT NULL DEFAULT false,
    "radarOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tests" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "equipment" TEXT,
    "source" TEXT,
    "comment" TEXT,
    "direction" "Direction" NOT NULL,
    "unit" TEXT NOT NULL,
    "qcMin" DOUBLE PRECISION,
    "qcMax" DOUBLE PRECISION,
    "qcDescription" TEXT,
    "changeThreshold" DOUBLE PRECISION,
    "cv" DOUBLE PRECISION,
    "alertBelow" DOUBLE PRECISION,
    "alertAbove" DOUBLE PRECISION,
    "protocolData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_sessions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "DateTime" TIMESTAMP(3) NOT NULL,
    "phase" "SessionPhase" NOT NULL,
    "time" TIMESTAMP(3),
    "tester" TEXT,
    "location" TEXT,
    "equipmentId" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'FULL',
    "source" "SessionSource" NOT NULL DEFAULT 'MANUAL',
    "comment" TEXT,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "test_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_results" (
    "id" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "score" DOUBLE PRECISION,
    "performanceDelta" DOUBLE PRECISION,
    "changeStatus" "ChangeStatus",
    "pbAchieved" BOOLEAN,
    "pbImprovement" DOUBLE PRECISION,
    "testId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "testSessionId" TEXT NOT NULL,
    "qcStatus" "QCStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "source" "SessionSource" DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "equipmentId" TEXT,

    CONSTRAINT "test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "norms" (
    "id" TEXT NOT NULL,
    "testCode" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "anchor10" DOUBLE PRECISION NOT NULL,
    "anchor25" DOUBLE PRECISION NOT NULL,
    "anchor50" DOUBLE PRECISION NOT NULL,
    "anchor75" DOUBLE PRECISION NOT NULL,
    "anchor90" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "testId" TEXT,

    CONSTRAINT "norms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_goals" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "achieved" BOOLEAN NOT NULL DEFAULT false,
    "achievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "player_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "purchaseDate" TIMESTAMP(3),
    "warrantyExp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "body_compositions" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "testSessionId" TEXT NOT NULL,
    "mass_kg" DOUBLE PRECISION,
    "fat_pct" DOUBLE PRECISION,
    "ffm_kg" DOUBLE PRECISION,
    "phase_angle" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "body_compositions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordsCount" INTEGER,
    "processedCount" INTEGER,
    "errors" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qc_flags" (
    "id" TEXT NOT NULL,
    "testResultId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "expected" TEXT NOT NULL,
    "actual" TEXT NOT NULL,
    "description" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qc_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SeasonToTeam" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "teams_code_key" ON "teams"("code");

-- CreateIndex
CREATE UNIQUE INDEX "players_teamId_playerId_key" ON "players"("teamId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "test_categories_code_key" ON "test_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tests_code_key" ON "tests"("code");

-- CreateIndex
CREATE UNIQUE INDEX "test_sessions_sessionId_key" ON "test_sessions"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "test_sessions_playerId_DateTime_phase_key" ON "test_sessions"("playerId", "DateTime", "phase");

-- CreateIndex
CREATE UNIQUE INDEX "test_results_testSessionId_testId_key" ON "test_results"("testSessionId", "testId");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_code_key" ON "equipment"("code");

-- CreateIndex
CREATE UNIQUE INDEX "_SeasonToTeam_AB_unique" ON "_SeasonToTeam"("A", "B");

-- CreateIndex
CREATE INDEX "_SeasonToTeam_B_index" ON "_SeasonToTeam"("B");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "test_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_testSessionId_fkey" FOREIGN KEY ("testSessionId") REFERENCES "test_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "norms" ADD CONSTRAINT "norms_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_goals" ADD CONSTRAINT "player_goals_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_goals" ADD CONSTRAINT "player_goals_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_compositions" ADD CONSTRAINT "body_compositions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_compositions" ADD CONSTRAINT "body_compositions_testSessionId_fkey" FOREIGN KEY ("testSessionId") REFERENCES "test_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_flags" ADD CONSTRAINT "qc_flags_testResultId_fkey" FOREIGN KEY ("testResultId") REFERENCES "test_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SeasonToTeam" ADD CONSTRAINT "_SeasonToTeam_A_fkey" FOREIGN KEY ("A") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SeasonToTeam" ADD CONSTRAINT "_SeasonToTeam_B_fkey" FOREIGN KEY ("B") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
