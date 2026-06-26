-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "winnerId" TEXT;

-- AlterTable
ALTER TABLE "Prediction" ADD COLUMN     "qualifierPick" TEXT;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
