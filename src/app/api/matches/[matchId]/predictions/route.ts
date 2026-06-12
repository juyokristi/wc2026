import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { matchId } = await params;

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const predictions = await prisma.prediction.findMany({
    where: { matchId },
    include: {
      user: { select: { displayName: true, name: true, image: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    predictions.map((p) => ({
      userName: p.user.displayName ?? p.user.name ?? "Player",
      userImage: p.user.image,
      predictedA: p.predictedA,
      predictedB: p.predictedB,
      pointsEarned: p.pointsEarned,
    }))
  );
}
