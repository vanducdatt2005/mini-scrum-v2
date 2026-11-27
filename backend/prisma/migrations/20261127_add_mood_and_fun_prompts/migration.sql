-- AlterTable
ALTER TABLE "daily_standups" ADD COLUMN IF NOT EXISTS "mood" TEXT DEFAULT 'NORMAL';
ALTER TABLE "daily_standups" ADD COLUMN IF NOT EXISTS "fun_prompt_question" TEXT;
ALTER TABLE "daily_standups" ADD COLUMN IF NOT EXISTS "fun_prompt_answer" TEXT;
