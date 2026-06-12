import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculatePoints } from "@/lib/scoring";

const FD_BASE = "https://api.football-data.org/v4";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "FOOTBALL_DATA_API_KEY not set" }, { status: 500 });
  }

  const res = await fetch(`${FD_BASE}/competitions/WC/matches?status=FINISHED`, {
    headers: { "X-Auth-Token": apiKey },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `football-data.org error: ${res.status}` },
      { status: 502 }
    );
  }

  const { matches: fdMatches } = await res.json() as {
    matches: Array<{
      homeTeam: { tla: string };
      awayTeam: { tla: string };
      score: { fullTime: { home: number | null; away: number | null } };
    }>;
  };

  // Fetch our unfinished matches that have both teams confirmed
  const ourMatches = await prisma.match.findMany({
    where: {
      status: { not: "FINISHED" },
      teamAId: { not: null },
      teamBId: { not: null },
    },
    include: {
      teamA: { select: { code: true } },
      teamB: { select: { code: true } },
    },
  });

  // Build a two-way lookup: "HOME-AWAY" → match (both orderings)
  const byTeamPair = new Map<string, typeof ourMatches[0]>();
  for (const m of ourMatches) {
    if (m.teamA && m.teamB) {
      byTeamPair.set(`${m.teamA.code}-${m.teamB.code}`, m);
      byTeamPair.set(`${m.teamB.code}-${m.teamA.code}`, m);
    }
  }

  let updated = 0;

  for (const fd of fdMatches) {
    const homeScore = fd.score?.fullTime?.home;
    const awayScore = fd.score?.fullTime?.away;
    if (homeScore === null || homeScore === undefined) continue;
    if (awayScore === null || awayScore === undefined) continue;

    const homeTla = fd.homeTeam?.tla?.toUpperCase();
    const awayTla = fd.awayTeam?.tla?.toUpperCase();
    if (!homeTla || !awayTla) continue;

    const m = byTeamPair.get(`${homeTla}-${awayTla}`);
    if (!m) continue;

    // Which side did football-data.org assign as teamA in our DB?
    const teamAIsHome = m.teamA!.code.toUpperCase() === homeTla;
    const scoreA = teamAIsHome ? homeScore : awayScore;
    const scoreB = teamAIsHome ? awayScore : homeScore;

    await prisma.match.update({
      where: { id: m.id },
      data: { scoreA, scoreB, status: "FINISHED" },
    });

    const predictions = await prisma.prediction.findMany({
      where: { matchId: m.id },
    });

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

    updated++;
  }

  return NextResponse.json({ updated, checked: fdMatches.length });
}
