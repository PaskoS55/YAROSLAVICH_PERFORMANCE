CREATE TABLE "local_users" (
  "id" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "login" TEXT NOT NULL,
  "login_normalized" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "recovery_key_hash" TEXT NOT NULL,
  "failed_login_count" INTEGER NOT NULL DEFAULT 0,
  "failed_recovery_count" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMP(3),
  "recovery_locked_until" TIMESTAMP(3),
  "last_login_at" TIMESTAMP(3),
  "disabled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "local_users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "local_users_login_normalized_key" ON "local_users"("login_normalized");
