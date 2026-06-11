import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { matchId, predictedA, predictedB } = body;

  if (
    typeof matchId !== "string" ||
    typeof predictedA !== "number" ||
    typeof predictedB !== "number" ||
    predictedA < 0 ||
    predictedB < 0 ||
    !Number.isInteger(predictedA) ||
    !Number.isInteger(predictedB)
  ) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (match.status !== "SCHEDULED" || match.kickoff <= new Date()) {
    return NextResponse.json({ error: "Predictions are locked for this match" }, { status: 403 });
  }

  const prediction = await prisma.prediction.upsert({
    where: { userId_matchId: { userId: session.user.id, matchId } },
    update: { predictedA, predictedB },
    create: { userId: session.user.id, matchId, predictedA, predictedB },
  });

  return NextResponse.json(prediction);
}
