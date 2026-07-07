import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { matchId, predictedA, predictedB, qualifierPick } = body;

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

  const isKnockout = match.stage !== "GROUP";
  const teamsKnown = match.teamAId != null && match.teamBId != null;

  // Validate qualifier pick for knockout matches
  let resolvedQualifierPick: string | null = null;
  if (qualifierPick != null) {
    if (!isKnockout) {
      return NextResponse.json({ error: "Qualifier pick not available in group stage" }, { status: 400 });
    }
    if (qualifierPick !== match.teamAId && qualifierPick !== match.teamBId) {
      return NextResponse.json({ error: "Invalid qualifier pick" }, { status: 400 });
    }
    resolvedQualifierPick = qualifierPick;
  } else if (isKnockout && teamsKnown) {
    // Auto-infer from predicted score for non-draws
    if (predictedA > predictedB) resolvedQualifierPick = match.teamAId!;
    else if (predictedB > predictedA) resolvedQualifierPick = match.teamBId!;
    else {
      return NextResponse.json({ error: "Pick who advances in extra time" }, { status: 400 });
    }
  }

  const prediction = await prisma.prediction.upsert({
    where: { userId_matchId: { userId: session.user.id, matchId } },
    update: { predictedA, predictedB, qualifierPick: resolvedQualifierPick },
    create: { userId: session.user.id, matchId, predictedA, predictedB, qualifierPick: resolvedQualifierPick },
  });

  return NextResponse.json(prediction);
}
