import { prisma } from "@/lib/prisma";
import { calculatePoints } from "@/lib/scoring";

const FD_BASE = "https://api.football-data.org/v4";

interface FdMatch {
  utcDate: string;
  status: string;
  venue: string | null;
  homeTeam: { tla: string };
  awayTeam: { tla: string };
  score: { fullTime: { home: number | null; away: number | null } };
}

export async function syncScores(): Promise<{
  scoresUpdated: number;
  kickoffsFixed: number;
  checked: number;
}> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    throw new Error("FOOTBALL_DATA_API_KEY not set");
  }

  // Fetch ALL matches (not just FINISHED) so we can sync kickoff times too
  const res = await fetch(`${FD_BASE}/competitions/WC/matches`, {
    headers: { "X-Auth-Token": apiKey },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`football-data.org error: ${res.status}`);
  }

  const { matches: fdMatches } = (await res.json()) as { matches: FdMatch[] };

  // Fetch all our matches that have both teams confirmed
  const ourMatches = await prisma.match.findMany({
    where: { teamAId: { not: null }, teamBId: { not: null } },
    include: {
      teamA: { select: { code: true } },
      teamB: { select: { code: true } },
    },
  });

  // Build two-way lookup by team pair
  const byTeamPair = new Map<string, (typeof ourMatches)[0]>();
  for (const m of ourMatches) {
    if (m.teamA && m.teamB) {
      byTeamPair.set(`${m.teamA.code}-${m.teamB.code}`, m);
      byTeamPair.set(`${m.teamB.code}-${m.teamA.code}`, m);
    }
  }

  let kickoffsFixed = 0;
  let scoresUpdated = 0;

  for (const fd of fdMatches) {
    const homeTla = fd.homeTeam?.tla?.toUpperCase();
    const awayTla = fd.awayTeam?.tla?.toUpperCase();
    if (!homeTla || !awayTla) continue;

    const m = byTeamPair.get(`${homeTla}-${awayTla}`);
    if (!m) continue;

    const teamAIsHome = m.teamA!.code.toUpperCase() === homeTla;
    const correctKickoff = new Date(fd.utcDate);

    const venueUpdate = fd.venue ? { venue: fd.venue } : {};

    if (fd.status === "FINISHED") {
      const homeScore = fd.score?.fullTime?.home;
      const awayScore = fd.score?.fullTime?.away;
      if (homeScore === null || homeScore === undefined) continue;
      if (awayScore === null || awayScore === undefined) continue;

      const scoreA = teamAIsHome ? homeScore : awayScore;
      const scoreB = teamAIsHome ? awayScore : homeScore;

      await prisma.match.update({
        where: { id: m.id },
        data: {
          scoreA,
          scoreB,
          status: "FINISHED",
          kickoff: correctKickoff,
          ...venueUpdate,
        },
      });

      const predictions = await prisma.prediction.findMany({
        where: { matchId: m.id },
      });
      await Promise.all(
        predictions.map((p) =>
          prisma.prediction.update({
            where: { id: p.id },
            data: {
              pointsEarned: calculatePoints(
                scoreA,
                scoreB,
                p.predictedA,
                p.predictedB
              ),
            },
          })
        )
      );
      scoresUpdated++;
    } else if (fd.status === "IN_PLAY" || fd.status === "PAUSED") {
      await prisma.match.update({
        where: { id: m.id },
        data: { status: "LIVE", kickoff: correctKickoff, ...venueUpdate },
      });
    } else {
      const storedKickoff = m.kickoff.getTime();
      const kickoffChanged =
        Math.abs(storedKickoff - correctKickoff.getTime()) > 60_000;
      if (kickoffChanged || fd.venue) {
        await prisma.match.update({
          where: { id: m.id },
          data: { kickoff: correctKickoff, ...venueUpdate },
        });
        if (kickoffChanged) kickoffsFixed++;
      }
    }
  }

  // Fix knockout team assignments
  const knockoutMatches = await prisma.match.findMany({
    where: {
      stage: { not: "GROUP" },
      status: { not: "FINISHED" },
      OR: [{ teamAId: null }, { teamBId: null }],
    },
  });

  if (knockoutMatches.length > 0) {
    // Build team lookup by code
    const allTeams = await prisma.team.findMany({
      select: { id: true, code: true },
    });
    const teamByCode = new Map(allTeams.map((t) => [t.code, t.id]));

    for (const fd of fdMatches) {
      if (
        fd.status === "FINISHED" ||
        fd.status === "IN_PLAY" ||
        fd.status === "PAUSED"
      )
        continue;
      const homeTla = fd.homeTeam?.tla?.toUpperCase();
      const awayTla = fd.awayTeam?.tla?.toUpperCase();
      if (
        !homeTla ||
        !awayTla ||
        homeTla === "TBD" ||
        awayTla === "TBD"
      )
        continue;

      const homeTeamId = teamByCode.get(homeTla);
      const awayTeamId = teamByCode.get(awayTla);
      if (!homeTeamId || !awayTeamId) continue;

      // Find knockout match on same day with null teams
      const fdDate = new Date(fd.utcDate);
      const dayStart = new Date(fdDate);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(fdDate);
      dayEnd.setUTCHours(23, 59, 59, 999);

      const matchEntry = knockoutMatches.find(
        (k) =>
          k.kickoff >= dayStart &&
          k.kickoff <= dayEnd &&
          (k.teamAId === null || k.teamBId === null)
      );

      if (!matchEntry) continue;

      await prisma.match.update({
        where: { id: matchEntry.id },
        data: {
          teamAId: homeTeamId,
          teamBId: awayTeamId,
          kickoff: fdDate,
        },
      });
    }
  }

  return { scoresUpdated, kickoffsFixed, checked: fdMatches.length };
}
