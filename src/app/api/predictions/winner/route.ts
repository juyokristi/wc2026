import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const FINAL_DATE = new Date("2026-07-19T00:00:00Z");

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pick = await prisma.winnerPrediction.findUnique({
    where: { userId: session.user.id },
    include: { team: { select: { name: true, flagEmoji: true, code: true } } },
  });

  return NextResponse.json({ pick });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.winnerPrediction.findUnique({
    where: { userId: session.user.id },
  });
  if (existing) {
    return NextResponse.json({ error: "Already locked" }, { status: 409 });
  }

  const { teamId } = await req.json();
  if (!teamId || typeof teamId !== "string") {
    return NextResponse.json({ error: "teamId required" }, { status: 400 });
  }

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const now = new Date();
  const potentialPoints = Math.max(
    0,
    Math.ceil((FINAL_DATE.getTime() - now.getTime()) / 86_400_000)
  );

  const pick = await prisma.winnerPrediction.create({
    data: { userId: session.user.id, teamId, potentialPoints },
    include: { team: { select: { name: true, flagEmoji: true, code: true } } },
  });

  return NextResponse.json({ pick }, { status: 201 });
}
