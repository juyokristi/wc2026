import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const grouped = await prisma.prediction.groupBy({
    by: ["userId"],
    _sum: { pointsEarned: true },
    _count: { id: true },
    where: { pointsEarned: { not: null } },
    orderBy: { _sum: { pointsEarned: "desc" } },
    take: 100,
  });

  if (grouped.length === 0) {
    return NextResponse.json([]);
  }

  const userIds = grouped.map((g) => g.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true, name: true, image: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const leaderboard = grouped.map((g, index) => ({
    rank: index + 1,
    user: userMap[g.userId],
    totalPoints: g._sum.pointsEarned ?? 0,
    predictionsScored: g._count.id,
  }));

  return NextResponse.json(leaderboard);
}
