import { prisma } from "@/lib/prisma";
import { calculatePoints } from "@/lib/scoring";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";

// WC2026 runs June 11 – July 19
const WC_START_STR = "2026-06-11";
const WC_END_STR   = "2026-07-19";

interface EspnCompetitor {
  homeAway: "home" | "away";
  score: string;
  winner?: boolean;
  team: { abbreviation: string };
}

interface EspnEvent {
  id: string;
  date: string; // ISO UTC
  competitions: Array<{
    status: { type: { name: string; completed: boolean } };
    competitors: EspnCompetitor[];
  }>;
}

function yyyymmdd(d: Date): string {
  return (
    String(d.getUTCFullYear()) +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0")
  );
}

async function fetchDay(dateStr: string): Promise<EspnEvent[]> {
  try {
    const res = await fetch(`${ESPN_BASE}/scoreboard?dates=${dateStr}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { events?: EspnEvent[] };
    return data.events ?? [];
  } catch {
    return [];
  }
}

export async function syncScores(): Promise<{
  scoresUpdated: number;
  kickoffsFixed: number;
  knockoutAssigned: number;
  checked: number;
  unseenFdStages: string[];
}> {
  // Fetch all tournament dates from June 11 through today + 14 days ahead
  // (covers active group stage + upcoming R32 kickoff updates)
  const start = new Date(WC_START_STR);
  const end = new Date(
    Math.min(
      Date.now() + 14 * 24 * 60 * 60 * 1000,
      new Date(WC_END_STR).getTime()
    )
  );

  const dates: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(yyyymmdd(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  // Fetch in parallel batches of 20
  const allEvents: EspnEvent[] = [];
  for (let i = 0; i < dates.length; i += 20) {
    const batch = await Promise.all(dates.slice(i, i + 20).map(fetchDay));
    allEvents.push(...batch.flat());
  }

  // Load DB matches that have both teams confirmed
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
      byTeamPair.set(`${m.teamA.code}-${m.teamB.code}`, m);
      byTeamPair.set(`${m.teamB.code}-${m.teamA.code}`, m);
    }
  }

  let scoresUpdated = 0;
  let kickoffsFixed = 0;

  for (const event of allEvents) {
    const comp = event.competitions[0];
    if (!comp) continue;

    const homeComp = comp.competitors.find((c) => c.homeAway === "home");
    const awayComp = comp.competitors.find((c) => c.homeAway === "away");
    if (!homeComp || !awayComp) continue;

    const homeCode = homeComp.team.abbreviation.toUpperCase();
    const awayCode = awayComp.team.abbreviation.toUpperCase();
    if (!homeCode || !awayCode) continue;

    const m = byTeamPair.get(`${homeCode}-${awayCode}`);
    if (!m) continue;

    const teamAIsHome = m.teamA!.code.toUpperCase() === homeCode;
    const kickoff = new Date(event.date);
    const { completed, name: statusName } = comp.status.type;

    if (completed) {
      const homeScore = parseInt(homeComp.score, 10);
      const awayScore = parseInt(awayComp.score, 10);
      if (isNaN(homeScore) || isNaN(awayScore)) continue;

      const scoreA = teamAIsHome ? homeScore : awayScore;
      const scoreB = teamAIsHome ? awayScore : homeScore;

      // For knockout matches determine winner (covers ET/penalties via ESPN winner flag)
      let winnerId: string | null = null;
      if (m.stage !== "GROUP") {
        if (homeComp.winner === true) {
          winnerId = teamAIsHome ? m.teamAId! : m.teamBId!;
        } else if (awayComp.winner === true) {
          winnerId = teamAIsHome ? m.teamBId! : m.teamAId!;
        } else if (scoreA > scoreB) {
          winnerId = m.teamAId!;
        } else if (scoreB > scoreA) {
          winnerId = m.teamBId!;
        }
      }

      await prisma.match.update({
        where: { id: m.id },
        data: {
          scoreA,
          scoreB,
          status: "FINISHED",
          kickoff,
          ...(winnerId ? { winnerId } : {}),
        },
      });

      // Award prediction points
      const predictions = await prisma.prediction.findMany({
        where: { matchId: m.id },
      });
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

      // Award winner-prediction points when the Final is scored
      if (m.stage === "FINAL" && winnerId) {
        const picks = await prisma.winnerPrediction.findMany({
          where: { pointsEarned: null },
        });
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
    } else if (statusName.includes("IN_PROGRESS") || statusName === "STATUS_HALFTIME") {
      await prisma.match.update({
        where: { id: m.id },
        data: { status: "LIVE", kickoff },
      });
    } else {
      // SCHEDULED — update kickoff only if it changed by more than 1 minute
      if (Math.abs(m.kickoff.getTime() - kickoff.getTime()) > 60_000) {
        await prisma.match.update({
          where: { id: m.id },
          data: { kickoff },
        });
        kickoffsFixed++;
      }
    }
  }

  return {
    scoresUpdated,
    kickoffsFixed,
    knockoutAssigned: 0, // R32+ team assignments handled by the Populate R32 admin action
    checked: allEvents.length,
    unseenFdStages: [], // field kept for API response compatibility
  };
}
