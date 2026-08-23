BEGIN;

CREATE TYPE "NormProfileScope" AS ENUM ('SYSTEM', 'ORGANIZATION', 'INSTALLATION_LEGACY');
CREATE TYPE "NormProfileStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DRAFT');
CREATE TYPE "NormInterpretationType" AS ENUM ('PUBLISHED_DISTRIBUTION', 'POOLED_ESTIMATE', 'EMPIRICAL_PERCENTILE', 'REFERENCE_RANGE', 'ORDINAL_SCALE', 'CONTEXT_ONLY', 'NO_REFERENCE');
CREATE TYPE "NormEvidenceLevel" AS ENUM ('HIGH', 'MODERATE', 'LOW', 'NOT_APPLICABLE');
CREATE TYPE "ReferenceSourceType" AS ENUM ('PEER_REVIEWED_ARTICLE', 'SYSTEMATIC_REVIEW', 'META_ANALYSIS', 'OFFICIAL_DATA', 'CUSTOM', 'LEGACY');
CREATE TYPE "NormSport" AS ENUM ('VOLLEYBALL');
CREATE TYPE "NormSex" AS ENUM ('MALE', 'FEMALE', 'MIXED', 'UNSPECIFIED');
CREATE TYPE "NormLevel" AS ENUM ('ELITE', 'PROFESSIONAL', 'COMPETITIVE', 'DEVELOPMENT', 'UNSPECIFIED');
CREATE TYPE "NormAgeGroup" AS ENUM ('ADULT', 'YOUTH', 'UNSPECIFIED');

CREATE TABLE "norm_profiles" (
  "id" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "sport" "NormSport" NOT NULL,
  "sex" "NormSex" NOT NULL, "level" "NormLevel" NOT NULL, "age_group" "NormAgeGroup" NOT NULL,
  "version" TEXT NOT NULL, "scope" "NormProfileScope" NOT NULL,
  "status" "NormProfileStatus" NOT NULL DEFAULT 'ACTIVE', "organization_id" TEXT, "base_profile_id" TEXT,
  "is_default_for_vertical" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "deleted_at" TIMESTAMP(3), CONSTRAINT "norm_profiles_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "norm_entries" (
  "id" TEXT NOT NULL, "profile_id" TEXT NOT NULL, "test_id" TEXT NOT NULL, "position" TEXT,
  "interpretation_type" "NormInterpretationType" NOT NULL, "evidence_level" "NormEvidenceLevel" NOT NULL,
  "evidence_scope" TEXT, "comparison_metric" TEXT, "mean" DOUBLE PRECISION, "sd" DOUBLE PRECISION,
  "ci_low" DOUBLE PRECISION, "ci_high" DOUBLE PRECISION, "reference_low" DOUBLE PRECISION, "reference_high" DOUBLE PRECISION,
  "p10" DOUBLE PRECISION, "p25" DOUBLE PRECISION, "p50" DOUBLE PRECISION, "p75" DOUBLE PRECISION, "p90" DOUBLE PRECISION,
  "sample_size" INTEGER, "valid_from" TIMESTAMP(3), "valid_until" TIMESTAMP(3), "protocol_key" TEXT,
  "protocol_text" TEXT, "measurement_method" TEXT, "source_text" TEXT,
  "derived_by_pasko" BOOLEAN NOT NULL DEFAULT false, "derived_approximate" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3), CONSTRAINT "norm_entries_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "reference_sources" (
  "id" TEXT NOT NULL, "code" TEXT NOT NULL, "title" TEXT NOT NULL, "authors" TEXT NOT NULL, "year" INTEGER NOT NULL,
  "journal" TEXT, "doi" TEXT, "pmid" TEXT, "url" TEXT, "source_type" "ReferenceSourceType" NOT NULL,
  "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reference_sources_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "norm_entry_sources" (
  "entry_id" TEXT NOT NULL, "source_id" TEXT NOT NULL, "role" TEXT NOT NULL DEFAULT 'PRIMARY',
  CONSTRAINT "norm_entry_sources_pkey" PRIMARY KEY ("entry_id", "source_id")
);
ALTER TABLE "teams" ADD COLUMN "active_norm_profile_id" TEXT;

CREATE UNIQUE INDEX "norm_profiles_code_key" ON "norm_profiles"("code");
CREATE INDEX "norm_profiles_scope_status_deleted_at_idx" ON "norm_profiles"("scope", "status", "deleted_at");
CREATE INDEX "norm_profiles_organization_id_status_deleted_at_idx" ON "norm_profiles"("organization_id", "status", "deleted_at");
CREATE INDEX "norm_profiles_sport_sex_level_status_idx" ON "norm_profiles"("sport", "sex", "level", "status");
CREATE UNIQUE INDEX "norm_entries_profile_test_position_period_key" ON "norm_entries"("profile_id", "test_id", "position", "valid_from", "valid_until") NULLS NOT DISTINCT WHERE "deleted_at" IS NULL;
CREATE INDEX "norm_entries_profile_id_test_id_position_deleted_at_idx" ON "norm_entries"("profile_id", "test_id", "position", "deleted_at");
CREATE INDEX "norm_entries_test_id_deleted_at_idx" ON "norm_entries"("test_id", "deleted_at");
CREATE UNIQUE INDEX "reference_sources_code_key" ON "reference_sources"("code");
CREATE INDEX "norm_entry_sources_source_id_idx" ON "norm_entry_sources"("source_id");
CREATE INDEX "teams_active_norm_profile_id_idx" ON "teams"("active_norm_profile_id");

ALTER TABLE "norm_profiles" ADD CONSTRAINT "norm_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "norm_profiles" ADD CONSTRAINT "norm_profiles_base_profile_id_fkey" FOREIGN KEY ("base_profile_id") REFERENCES "norm_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "norm_entries" ADD CONSTRAINT "norm_entries_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "norm_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "norm_entries" ADD CONSTRAINT "norm_entries_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "norm_entry_sources" ADD CONSTRAINT "norm_entry_sources_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "norm_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "norm_entry_sources" ADD CONSTRAINT "norm_entry_sources_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "reference_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "teams" ADD CONSTRAINT "teams_active_norm_profile_id_fkey" FOREIGN KEY ("active_norm_profile_id") REFERENCES "norm_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
DECLARE unresolved_count INTEGER; legacy_count INTEGER; migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO legacy_count FROM "norms";
  SELECT COUNT(*) INTO unresolved_count FROM "norms" n
  LEFT JOIN "tests" direct_test ON direct_test."id" = n."testId"
  LEFT JOIN "tests" code_test ON code_test."code" = n."testCode"
  WHERE COALESCE(direct_test."id", code_test."id") IS NULL;
  IF unresolved_count > 0 THEN RAISE EXCEPTION 'Cannot migrate % legacy norms: unresolved Test relation', unresolved_count; END IF;
  IF legacy_count > 0 THEN
    INSERT INTO "norm_profiles" ("id", "code", "name", "sport", "sex", "level", "age_group", "version", "scope", "status", "is_default_for_vertical", "createdAt", "updatedAt")
    VALUES ('legacy-imported-profile', 'LEGACY_IMPORTED', 'Импортированные нормативы предыдущей версии', 'VOLLEYBALL', 'UNSPECIFIED', 'UNSPECIFIED', 'UNSPECIFIED', 'legacy', 'INSTALLATION_LEGACY', 'ACTIVE', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "norm_entries" ("id", "profile_id", "test_id", "position", "interpretation_type", "evidence_level", "p10", "p25", "p50", "p75", "p90", "source_text", "valid_from", "valid_until", "createdAt", "updatedAt", "deleted_at")
    SELECT 'legacy-entry-' || md5(n."id"), 'legacy-imported-profile', COALESCE(direct_test."id", code_test."id"),
      CASE WHEN lower(trim(n."position")) IN ('', 'all', 'overall', '*') THEN NULL ELSE n."position" END,
      'EMPIRICAL_PERCENTILE', 'LOW', n."anchor10", n."anchor25", n."anchor50", n."anchor75", n."anchor90",
      n."source", n."validFrom", n."validUntil", n."createdAt", n."updatedAt", n."deleted_at"
    FROM "norms" n LEFT JOIN "tests" direct_test ON direct_test."id" = n."testId" LEFT JOIN "tests" code_test ON code_test."code" = n."testCode";
    SELECT COUNT(*) INTO migrated_count FROM "norm_entries" WHERE "profile_id" = 'legacy-imported-profile';
    IF migrated_count <> legacy_count THEN RAISE EXCEPTION 'Legacy norm migration count mismatch: % before, % after', legacy_count, migrated_count; END IF;
  END IF;
END $$;
DROP TABLE "norms";

COMMIT;
