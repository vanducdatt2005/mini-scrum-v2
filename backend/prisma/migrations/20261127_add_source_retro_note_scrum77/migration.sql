-- AlterTable
ALTER TABLE "UserStory" ADD COLUMN "sourceRetroNoteId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UserStory_sourceRetroNoteId_key" ON "UserStory"("sourceRetroNoteId");

-- AddForeignKey
ALTER TABLE "UserStory" ADD CONSTRAINT "UserStory_sourceRetroNoteId_fkey" FOREIGN KEY ("sourceRetroNoteId") REFERENCES "RetroNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

