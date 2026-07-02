import { prisma } from "@/lib/prisma";
import { calculatePoints } from "@/lib/scoring";
import { rebuildBracket } from "@/lib/bracket";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";

const WC_START_STR = "2026-06-11";
const WC_END_STR   = "2026-07-19";

const ESPN_SLUG_TO_STAGE: Record<string, string> = {
  "group-stage":     "GROUP",
  "round-of-32":     "ROUND_OF_32",
  "round-of-16":     "ROUND_OF_16",
  "quarterfinals":   "QUARTER_FINAL",
  "semifinals":      "SEMI_FINAL",
  "3rd-place-match": "THIRD_PLACE",
  "final":           "FINAL",
};

interface EspnCompetitor {
  homeAway: "home" | "away";
  score: string;
  winner?: boolean;
  team: { abbreviation: string };
  linescores?: Array<{ displayValue: string; period: number }>;
}

interface EspnEvent {
  id: string;
  date: string;
  season?: { slug: string };
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
    const res = await fetch(`${ESPN_BASE}/scoreboard?dates=${dateStr}`, { cache: "no-store" });
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
  const start = new Date(WC_START_STR);
  const end = new Date(
    Math.min(Date.now() + 14 * 24 * 60 * 60 * 1000, new Date(WC_END_STR).getTime())
  );

  const dates: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(yyyymmdd(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const allEvents: EspnEvent[] = [];
  for (let i = 0; i < dates.length; i += 20) {
    const batch = await Promise.all(dates.slice(i, i + 20).map(fetchDay));
    allEvents.push(...batch.flat());
  }

  // Build a lookup keyed by STAGE:codeA-codeB (both orderings) so ESPN events
  // can be matched to DB matches regardless of home/away orientation.
  const ourMatches = await prisma.match.findMany({
    where: { teamAId: { not: null }, teamBId: { not: null } },
    include: {
      teamA: { select: { code: true } },
      teamB: { select: { code: true } },
    },
  });

  const byTeamPair = new Map<string, (typeof ourMatches)[0]>();
  for (const m of ourMatches) {
    const teamA = m.teamA;
    const teamB = m.teamB;
    if (teamA && teamB) {
      const cA = teamA.code.toUpperCase();
      const cB = teamB.code.toUpperCase();
      byTeamPair.set(`${m.stage}:${cA}-${cB}`, m);
      byTeamPair.set(`${m.stage}:${cB}-${cA}`, m);
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
    if (homeCode === "RD32" || awayCode === "RD32") continue; // TBD — skip

    const slug = event.season?.slug ?? "";
    const dbStage = ESPN_SLUG_TO_STAGE[slug];
    if (!dbStage) continue;

    const m = byTeamPair.get(`${dbStage}:${homeCode}-${awayCode}`);
    if (!m) continue;

    const teamAIsHome = m.teamA!.code.toUpperCase() === homeCode;
    const kickoff = new Date(event.date);
    const { completed, name: statusName } = comp.status.type;

    if (completed) {
      // For AET/penalty matches, score predictions against the 90-min result only.
      // ESPN's `score` field reflects the full 120-min score; sum periods 1+2 to get regulation.
      const isAET = statusName === "STATUS_FINAL_AET" || statusName === "STATUS_FINAL_PEN";
      const overtime = isAET
        ? statusName === "STATUS_FINAL_PEN" ? "PEN" : "AET"
        : null;

      let homeScore: number;
      let awayScore: number;
      let homeScoreFull: number | null = null;
      let awayScoreFull: number | null = null;

      const rawHome = parseInt(homeComp.score, 10);
      const rawAway = parseInt(awayComp.score, 10);
      if (isNaN(rawHome) || isNaN(rawAway)) continue;

      if (isAET && homeComp.linescores && awayComp.linescores) {
        homeScore = homeComp.linescores
          .filter((ls) => ls.period <= 2)
          .reduce((sum, ls) => sum + parseInt(ls.displayValue, 10), 0);
        awayScore = awayComp.linescores
          .filter((ls) => ls.period <= 2)
          .reduce((sum, ls) => sum + parseInt(ls.displayValue, 10), 0);
        homeScoreFull = rawHome;
        awayScoreFull = rawAway;
      } else {
        homeScore = rawHome;
        awayScore = rawAway;
      }

      const scoreA = teamAIsHome ? homeScore : awayScore;
      const scoreB = teamAIsHome ? awayScore : homeScore;
      const scoreAFull = homeScoreFull !== null ? (teamAIsHome ? homeScoreFull : awayScoreFull) : null;
      const scoreBFull = awayScoreFull !== null ? (teamAIsHome ? awayScoreFull : homeScoreFull) : null;

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
          scoreA, scoreB, status: "FINISHED", kickoff,
          ...(scoreAFull !== null ? { scoreAFull, scoreBFull } : {}),
          ...(overtime ? { overtime } : {}),
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
    } else if (statusName.includes("IN_PROGRESS") || statusName === "STATUS_HALFTIME") {
      await prisma.match.update({ where: { id: m.id }, data: { status: "LIVE", kickoff } });
    } else {
      if (Math.abs(m.kickoff.getTime() - kickoff.getTime()) > 60_000) {
        await prisma.match.update({ where: { id: m.id }, data: { kickoff } });
        kickoffsFixed++;
      }
    }
  }

  // Propagate winners into future slots and recompute all labels from current results.
  const { assigned: knockoutAssigned } = await rebuildBracket();

  return {
    scoresUpdated,
    kickoffsFixed,
    knockoutAssigned,
    checked: allEvents.length,
    unseenFdStages: [],
  };
}
