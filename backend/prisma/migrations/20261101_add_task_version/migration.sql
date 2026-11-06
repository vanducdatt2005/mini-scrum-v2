-- AlterTable
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Task_id_version_idx" ON "Task"("id", "version");

-- Backfill existing tasks
UPDATE "Task" SET "version" = 1 WHERE "version" IS NULL;
