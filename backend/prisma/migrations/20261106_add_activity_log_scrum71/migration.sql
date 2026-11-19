-- AlterTable: Add SCRUM-71 fields to activity_logs
ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "project_id" TEXT;
ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "action" TEXT;
ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "target_type" TEXT;
ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "target_id" TEXT;
ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "target_title" TEXT;
ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "meta" JSONB;

-- Make previous fields nullable to allow flexible logging
ALTER TABLE "activity_logs" ALTER COLUMN "entity_type" DROP NOT NULL;
ALTER TABLE "activity_logs" ALTER COLUMN "entity_id" DROP NOT NULL;
ALTER TABLE "activity_logs" ALTER COLUMN "action_type" DROP NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "activity_logs_project_id_created_at_idx" ON "activity_logs"("project_id", "created_at" DESC);

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activity_logs_project_id_fkey'
  ) THEN
    ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

