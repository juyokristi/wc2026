import { prisma } from "@/lib/prisma";
import { calculatePoints } from "@/lib/scoring";
import { rebuildBracket } from "@/lib/bracket";

const FD_BASE = "https://api.football-data.org/v4";

const FD_STAGE_MAP: Record<string, string> = {
  GROUP_STAGE:    "GROUP",
  LAST_32:        "ROUND_OF_32",
  ROUND_OF_32:    "ROUND_OF_32",
  LAST_16:        "ROUND_OF_16",
  ROUND_OF_16:    "ROUND_OF_16",
  QUARTER_FINALS: "QUARTER_FINAL",
  QUARTER_FINAL:  "QUARTER_FINAL",
  SEMI_FINALS:    "SEMI_FINAL",
  SEMI_FINAL:     "SEMI_FINAL",
  THIRD_PLACE:    "THIRD_PLACE",
  FINAL:          "FINAL",
};

const TLA_MAP: Record<string, string> = { URY: "URU" };
function normTla(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const up = raw.toUpperCase();
  if (up === "TBD" || up === "") return null;
  return TLA_MAP[up] ?? up;
}

interface FdScore {
  winner: string | null;
  duration: string;
  fullTime: { home: number | null; away: number | null };
  regularTime: { home: number | null; away: number | null } | null;
  extraTime: { home: number | null; away: number | null } | null;
  halfTime: { home: number | null; away: number | null } | null;
}

interface FdMatch {
  utcDate: string;
  status: string;
  stage: string;
  homeTeam: { tla: string | null };
  awayTeam: { tla: string | null };
  score: FdScore;
}

export async function syncScores(): Promise<{
  scoresUpdated: number;
  kickoffsFixed: number;
  knockoutAssigned: number;
  checked: number;
  unseenFdStages: string[];
}> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) throw new Error("FOOTBALL_DATA_API_KEY not set");

  const res = await fetch(`${FD_BASE}/competitions/WC/matches`, {
    headers: { "X-Auth-Token": apiKey },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`FD API error: ${res.status}`);

  const { matches: fdMatches } = (await res.json()) as { matches: FdMatch[] };

  const ourMatches = await prisma.match.findMany({
    where: { teamAId: { not: null }, teamBId: { not: null } },
    include: {
      teamA: { select: { code: true } },
      teamB: { select: { code: true } },
    },
  });

  const byTeamPair = new Map<string, (typeof ourMatches)[0]>();
  for (const m of ourMatches) {
    if (m.teamA && m.teamB) {
      const cA = m.teamA.code.toUpperCase();
      const cB = m.teamB.code.toUpperCase();
      byTeamPair.set(`${m.stage}:${cA}-${cB}`, m);
      byTeamPair.set(`${m.stage}:${cB}-${cA}`, m);
    }
  }

  let scoresUpdated = 0;
  let kickoffsFixed = 0;
  const unseenFdStages: string[] = [];

  for (const fd of fdMatches) {
    const dbStage = FD_STAGE_MAP[fd.stage];
    if (!dbStage) {
      if (!unseenFdStages.includes(fd.stage)) unseenFdStages.push(fd.stage);
      continue;
    }

    const homeTla = normTla(fd.homeTeam?.tla);
    const awayTla = normTla(fd.awayTeam?.tla);
    if (!homeTla || !awayTla) continue;

    const m = byTeamPair.get(`${dbStage}:${homeTla}-${awayTla}`);
    if (!m) continue;

    const kickoff = new Date(fd.utcDate);

    if (fd.status === "FINISHED") {
      const { duration, fullTime, regularTime, extraTime, halfTime, winner } = fd.score;
      if (fullTime.home === null || fullTime.away === null) continue;

      const isAET = duration === "EXTRA_TIME" || duration === "PENALTY_SHOOTOUT";

      // 90-min score for point calculation.
      // FD provides regularTime directly when it goes to AET, but falls back gracefully:
      //   1. regularTime (explicit)
      //   2. fullTime - extraTime (derivable)
      //   3. halfTime * 2 is not reliable — just use fullTime as last resort
      let home90: number;
      let away90: number;
      if (!isAET) {
        home90 = fullTime.home;
        away90 = fullTime.away;
      } else if (regularTime?.home !== null && regularTime?.home !== undefined &&
                 regularTime?.away !== null && regularTime?.away !== undefined) {
        home90 = regularTime.home;
        away90 = regularTime.away;
      } else if (extraTime?.home !== null && extraTime?.home !== undefined &&
                 extraTime?.away !== null && extraTime?.away !== undefined) {
        home90 = fullTime.home - extraTime.home;
        away90 = fullTime.away - extraTime.away;
      } else {
        // FD data incomplete — can't derive 90-min score, log and skip scoring
        console.warn(`[sync] AET match missing regularTime+extraTime: ${homeTla} vs ${awayTla}`);
        continue;
      }

      const teamAIsHome = m.teamA!.code.toUpperCase() === homeTla;
      const scoreA = teamAIsHome ? home90 : away90;
      const scoreB = teamAIsHome ? away90 : home90;
      const scoreAFull = isAET ? (teamAIsHome ? fullTime.home : fullTime.away) : null;
      const scoreBFull = isAET ? (teamAIsHome ? fullTime.away : fullTime.home) : null;
      const overtime = isAET
        ? duration === "PENALTY_SHOOTOUT" ? "PEN" : "AET"
        : null;

      let winnerId: string | null = null;
      if (m.stage !== "GROUP") {
        if (winner === "HOME_TEAM") winnerId = teamAIsHome ? m.teamAId! : m.teamBId!;
        else if (winner === "AWAY_TEAM") winnerId = teamAIsHome ? m.teamBId! : m.teamAId!;
      }

      await prisma.match.update({
        where: { id: m.id },
        data: {
          scoreA, scoreB,
          scoreAFull, scoreBFull,
          overtime,
          status: "FINISHED",
          kickoff,
          ...(winnerId ? { winnerId } : {}),
        },
      });

      const predictions = await prisma.prediction.findMany({ where: { matchId: m.id } });
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

      if (m.stage === "FINAL" && winnerId) {
        const picks = await prisma.winnerPrediction.findMany({ where: { pointsEarned: null } });
        await Promise.all(
          picks.map((wp) =>
            prisma.winnerPrediction.update({
              where: { id: wp.id },
              data: { pointsEarned: wp.teamId === winnerId ? wp.potentialPoints : 0 },
            })
          )
        );
      }

      scoresUpdated++;
    } else if (fd.status === "IN_PLAY" || fd.status === "PAUSED" || fd.status === "LIVE") {
      await prisma.match.update({ where: { id: m.id }, data: { status: "LIVE", kickoff } });
    } else if (fd.status === "SCHEDULED" || fd.status === "TIMED") {
      if (Math.abs(m.kickoff.getTime() - kickoff.getTime()) > 60_000) {
        await prisma.match.update({ where: { id: m.id }, data: { kickoff } });
        kickoffsFixed++;
      }
    }
  }

  const { assigned: knockoutAssigned } = await rebuildBracket();

  return {
    scoresUpdated,
    kickoffsFixed,
    knockoutAssigned,
    checked: fdMatches.length,
    unseenFdStages,
  };
}
