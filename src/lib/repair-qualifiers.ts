import { prisma } from "@/lib/prisma";

export async function repairQualifierPicks(): Promise<{
  scanned: number;
  fixed: number;
  bonusAwarded: number;
  details: { user: string; match: number; pts: number; newPts: number }[];
}> {
  // All finished knockout predictions with qualifierPick=null and non-draw predicted score
  const preds = await prisma.prediction.findMany({
    where: {
      qualifierPick: null,
      match: {
        status: "FINISHED",
        stage: { not: "GROUP" },
        winnerId: { not: null },
        teamAId: { not: null },
        teamBId: { not: null },
      },
    },
    include: {
      user: { select: { name: true, displayName: true } },
      match: { select: { matchNumber: true, winnerId: true, teamAId: true, teamBId: true } },
    },
  });

  const nonDraws = preds.filter((p) => p.predictedA !== p.predictedB);

  let fixed = 0;
  let bonusAwarded = 0;
  const details: { user: string; match: number; pts: number; newPts: number }[] = [];

  await Promise.all(
    nonDraws.map(async (p) => {
      const expectedPick =
        p.predictedA > p.predictedB ? p.match.teamAId! : p.match.teamBId!;
      const correctPick = expectedPick === p.match.winnerId;
      const currentPts = p.pointsEarned ?? 0;
      const newPts = correctPick ? currentPts + 2 : currentPts;

      await prisma.prediction.update({
        where: { id: p.id },
        data: {
          qualifierPick: expectedPick,
          ...(correctPick ? { pointsEarned: newPts } : {}),
        },
      });

      fixed++;
      if (correctPick) bonusAwarded++;
      details.push({
        user: p.user.displayName ?? p.user.name ?? "Unknown",
        match: p.match.matchNumber,
        pts: currentPts,
        newPts,
      });
    })
  );

  return { scanned: preds.length, fixed, bonusAwarded, details };
}
