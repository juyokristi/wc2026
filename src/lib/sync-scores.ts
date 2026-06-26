import { prisma } from "@/lib/prisma";
import { calculatePoints } from "@/lib/scoring";

const FD_BASE = "https://api.football-data.org/v4";

const TLA_MAP: Record<string, string> = {
  URY: "URU",
};
function normalizeTla(tla: string): string {
  return TLA_MAP[tla] ?? tla;
}

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
    const homeTla = normalizeTla(fd.homeTeam?.tla?.toUpperCase() ?? "");
    const awayTla = normalizeTla(fd.awayTeam?.tla?.toUpperCase() ?? "");
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

      if (m.stage === "FINAL") {
        const winnerId = scoreA > scoreB ? m.teamAId : scoreB > scoreA ? m.teamBId : null;
        if (winnerId) {
          const winnerPicks = await prisma.winnerPrediction.findMany({
            where: { pointsEarned: null },
          });
          await Promise.all(
            winnerPicks.map((wp) =>
              prisma.winnerPrediction.update({
                where: { id: wp.id },
                data: { pointsEarned: wp.teamId === winnerId ? wp.potentialPoints : 0 },
              })
            )
          );
        }
      }

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

  // Sync knockout team assignments for matches still missing a team
  const knockoutPending = await prisma.match.findMany({
    where: {
      stage: { not: "GROUP" },
      status: { not: "FINISHED" },
      OR: [{ teamAId: null }, { teamBId: null }],
    },
    select: { id: true, kickoff: true },
  });

  if (knockoutPending.length > 0) {
    const allTeams = await prisma.team.findMany({ select: { id: true, code: true } });
    const teamByCode = new Map(allTeams.map((t) => [t.code, t.id]));

    // Collect FD scheduled matches that have real (non-TBD) teams, grouped by UTC date
    const fdKnownByDay = new Map<string, FdMatch[]>();
    for (const fd of fdMatches) {
      if (fd.status === "FINISHED" || fd.status === "IN_PLAY" || fd.status === "PAUSED") continue;
      const homeTla = normalizeTla(fd.homeTeam?.tla?.toUpperCase() ?? "");
      const awayTla = normalizeTla(fd.awayTeam?.tla?.toUpperCase() ?? "");
      if (!homeTla || !awayTla || homeTla === "TBD" || awayTla === "TBD") continue;
      if (!teamByCode.has(homeTla) || !teamByCode.has(awayTla)) continue;
      const day = new Date(fd.utcDate).toISOString().split("T")[0];
      if (!fdKnownByDay.has(day)) fdKnownByDay.set(day, []);
      fdKnownByDay.get(day)!.push(fd);
    }

    // Group pending DB matches by UTC date
    const dbPendingByDay = new Map<string, typeof knockoutPending>();
    for (const k of knockoutPending) {
      const day = k.kickoff.toISOString().split("T")[0];
      if (!dbPendingByDay.has(day)) dbPendingByDay.set(day, []);
      dbPendingByDay.get(day)!.push(k);
    }

    // Pair FD ↔ DB by day, sorted by kickoff time so two matches on the same day
    // don't get each other's teams (fixes the double-assignment bug)
    for (const [day, fdList] of fdKnownByDay) {
      const dbList = dbPendingByDay.get(day);
      if (!dbList || dbList.length === 0) continue;

      const sortedFd = [...fdList].sort(
        (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
      );
      const sortedDb = [...dbList].sort(
        (a, b) => a.kickoff.getTime() - b.kickoff.getTime()
      );

      for (let i = 0; i < Math.min(sortedFd.length, sortedDb.length); i++) {
        const fd = sortedFd[i];
        const db = sortedDb[i];
        const homeTla = normalizeTla(fd.homeTeam.tla.toUpperCase());
        const awayTla = normalizeTla(fd.awayTeam.tla.toUpperCase());
        const homeTeamId = teamByCode.get(homeTla)!;
        const awayTeamId = teamByCode.get(awayTla)!;
        const fdKickoff = new Date(fd.utcDate);
        await prisma.match.update({
          where: { id: db.id },
          data: {
            teamAId: homeTeamId,
            teamBId: awayTeamId,
            kickoff: fdKickoff,
            ...(fd.venue ? { venue: fd.venue } : {}),
          },
        });
      }
    }
  }

  return { scoresUpdated, kickoffsFixed, checked: fdMatches.length };
}
