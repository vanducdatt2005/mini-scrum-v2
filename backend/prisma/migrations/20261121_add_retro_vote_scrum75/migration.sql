-- CreateTable
CREATE TABLE IF NOT EXISTS "RetroVote" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetroVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RetroVote_noteId_userId_key" ON "RetroVote"("noteId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RetroVote_noteId_idx" ON "RetroVote"("noteId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RetroVote_userId_idx" ON "RetroVote"("userId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RetroVote_noteId_fkey'
  ) THEN
    ALTER TABLE "RetroVote" ADD CONSTRAINT "RetroVote_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "RetroNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RetroVote_userId_fkey'
  ) THEN
    ALTER TABLE "RetroVote" ADD CONSTRAINT "RetroVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

