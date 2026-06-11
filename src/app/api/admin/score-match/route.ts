import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculatePoints } from "@/lib/scoring";

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
  const { matchId, scoreA, scoreB } = body;

  if (
    typeof matchId !== "string" ||
    typeof scoreA !== "number" ||
    typeof scoreB !== "number" ||
    scoreA < 0 ||
    scoreB < 0 ||
    !Number.isInteger(scoreA) ||
    !Number.isInteger(scoreB)
  ) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await prisma.match.update({
    where: { id: matchId },
    data: { scoreA, scoreB, status: "FINISHED" },
  });

  const predictions = await prisma.prediction.findMany({ where: { matchId } });

  await Promise.all(
    predictions.map((p) =>
      prisma.prediction.update({
        where: { id: p.id },
        data: {
          pointsEarned: calculatePoints(scoreA, scoreB, p.predictedA, p.predictedB),
        },
      })
    )
  );

  return NextResponse.json({ ok: true, predictionsScored: predictions.length });
}
