-- CreateTable
CREATE TABLE "WinnerPrediction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "potentialPoints" INTEGER NOT NULL,
    "pointsEarned" INTEGER,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WinnerPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WinnerPrediction_userId_key" ON "WinnerPrediction"("userId");

-- AddForeignKey
ALTER TABLE "WinnerPrediction" ADD CONSTRAINT "WinnerPrediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WinnerPrediction" ADD CONSTRAINT "WinnerPrediction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
