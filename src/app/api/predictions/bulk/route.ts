import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { predictions } = body;

  if (!Array.isArray(predictions) || predictions.length === 0) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const matchIds = predictions.map((p: { matchId: unknown }) => p.matchId).filter((id): id is string => typeof id === "string");
  const matches = await prisma.match.findMany({
    where: { id: { in: matchIds } },
    select: { id: true, status: true, kickoff: true, stage: true, teamAId: true, teamBId: true },
  });
  const matchMap = Object.fromEntries(matches.map((m) => [m.id, m]));
  const now = new Date();

  const valid: { matchId: string; predictedA: number; predictedB: number; qualifierPick: string | null }[] = [];
  for (const p of predictions) {
    const { matchId, predictedA, predictedB } = p;
    if (
      typeof matchId !== "string" ||
      typeof predictedA !== "number" ||
      typeof predictedB !== "number" ||
      !Number.isInteger(predictedA) ||
      !Number.isInteger(predictedB) ||
      predictedA < 0 ||
      predictedB < 0
    ) continue;
    const match = matchMap[matchId];
    if (!match || match.status !== "SCHEDULED" || match.kickoff <= now) continue;
    let qualifierPick: string | null = null;
    if (match.stage !== "GROUP" && match.teamAId && match.teamBId) {
      if (predictedA > predictedB) qualifierPick = match.teamAId;
      else if (predictedB > predictedA) qualifierPick = match.teamBId;
    }
    valid.push({ matchId, predictedA, predictedB, qualifierPick });
  }

  if (valid.length === 0) {
    return NextResponse.json({ error: "No valid predictions" }, { status: 400 });
  }

  await prisma.$transaction(
    valid.map((p) =>
      prisma.prediction.upsert({
        where: { userId_matchId: { userId: session.user.id, matchId: p.matchId } },
        update: { predictedA: p.predictedA, predictedB: p.predictedB, qualifierPick: p.qualifierPick },
        create: { userId: session.user.id, matchId: p.matchId, predictedA: p.predictedA, predictedB: p.predictedB, qualifierPick: p.qualifierPick },
      })
    )
  );

  return NextResponse.json({ saved: valid.length });
}
