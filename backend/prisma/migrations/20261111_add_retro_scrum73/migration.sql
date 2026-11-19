-- CreateTable
CREATE TABLE IF NOT EXISTS "RetroSession" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sprintId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetroSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RetroNote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "column" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetroNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RetroSession_projectId_idx" ON "RetroSession"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RetroNote_sessionId_idx" ON "RetroNote"("sessionId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RetroSession_projectId_fkey'
  ) THEN
    ALTER TABLE "RetroSession" ADD CONSTRAINT "RetroSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RetroSession_sprintId_fkey'
  ) THEN
    ALTER TABLE "RetroSession" ADD CONSTRAINT "RetroSession_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RetroSession_createdById_fkey'
  ) THEN
    ALTER TABLE "RetroSession" ADD CONSTRAINT "RetroSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RetroNote_sessionId_fkey'
  ) THEN
    ALTER TABLE "RetroNote" ADD CONSTRAINT "RetroNote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RetroSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RetroNote_authorId_fkey'
  ) THEN
    ALTER TABLE "RetroNote" ADD CONSTRAINT "RetroNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

