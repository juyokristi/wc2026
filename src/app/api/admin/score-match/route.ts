import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculatePoints } from "@/lib/scoring";

function isValidScore(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || session.user.email !== adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { matchNumber, scoreA, scoreB, scoreAFull, scoreBFull, overtime } = body;

  if (!isValidScore(scoreA) || !isValidScore(scoreB)) {
    return NextResponse.json({ error: "Invalid 90-min scores" }, { status: 400 });
  }
  if (typeof matchNumber !== "number" || !Number.isInteger(matchNumber)) {
    return NextResponse.json({ error: "matchNumber required" }, { status: 400 });
  }

  const hasFullScore = scoreAFull !== undefined || scoreBFull !== undefined;
  if (hasFullScore && (!isValidScore(scoreAFull) || !isValidScore(scoreBFull))) {
    return NextResponse.json({ error: "Invalid AET scores" }, { status: 400 });
  }
  if (overtime !== undefined && overtime !== "AET" && overtime !== "PEN" && overtime !== null) {
    return NextResponse.json({ error: "overtime must be AET, PEN, or null" }, { status: 400 });
  }

  const match = await prisma.match.findUnique({ where: { matchNumber } });
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const winnerId = (() => {
    if (match.stage === "GROUP") return undefined;
    if (scoreA > scoreB) return match.teamAId ?? undefined;
    if (scoreB > scoreA) return match.teamBId ?? undefined;
    // Draw at 90 min in knockout — winner from AET/pens
    if (hasFullScore && isValidScore(scoreAFull) && isValidScore(scoreBFull)) {
      if (scoreAFull > scoreBFull) return match.teamAId ?? undefined;
      if (scoreBFull > scoreAFull) return match.teamBId ?? undefined;
    }
    return undefined;
  })();

  await prisma.match.update({
    where: { matchNumber },
    data: {
      scoreA,
      scoreB,
      status: "FINISHED",
      ...(hasFullScore ? { scoreAFull, scoreBFull } : {}),
      ...(overtime !== undefined ? { overtime } : {}),
      ...(winnerId ? { winnerId } : {}),
    },
  });

  const predictions = await prisma.prediction.findMany({ where: { matchId: match.id } });

  await Promise.all(
    predictions.map((p) => {
      const base = calculatePoints(scoreA, scoreB, p.predictedA, p.predictedB);
      const bonus = winnerId && p.qualifierPick === winnerId ? 2 : 0;
      return prisma.prediction.update({
        where: { id: p.id },
        data: { pointsEarned: base + bonus },
      });
    })
  );

  return NextResponse.json({ ok: true, predictionsScored: predictions.length });
}
