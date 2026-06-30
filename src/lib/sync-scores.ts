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

// WC2026 bracket progression: matchNumber → next match + which slot the winner fills.
// R32 (73-88) → R16 (89-96) → QF (97-100) → SF (101-102) → Final (104).
// Loser of each SF feeds match 103 (3rd place).
// R32 DB matchNumbers 73-88 (M1-M16); R16 DB 89-96 (M1-M8); QF 97-100; SF 101-102.
// R32 → R16 pairings sourced from official WC2026 draw (flashfootball.com confirmed):
//   M1(73)+M3(75)→89, M4(76)+M6(78)→90, M2(74)+M5(77)→91, M7(79)+M8(80)→92,
//   M9(81)+M10(82)→93, M11(83)+M12(84)→94, M13(85)+M15(87)→95, M14(86)+M16(88)→96
const BRACKET_NEXT: Record<number, { nextMatch: number; slot: "home" | "away" }> = {
  // R32 → R16
  73: { nextMatch: 89, slot: "home" }, 75: { nextMatch: 89, slot: "away" }, // R16 M1: Canada vs Morocco
  76: { nextMatch: 90, slot: "home" }, 78: { nextMatch: 90, slot: "away" }, // R16 M2: Brazil vs IvCoast/NOR
  74: { nextMatch: 91, slot: "home" }, 77: { nextMatch: 91, slot: "away" }, // R16 M3: Paraguay vs FRA/SWE
  79: { nextMatch: 92, slot: "home" }, 80: { nextMatch: 92, slot: "away" }, // R16 M4: MEX vs ENG/DRC
  81: { nextMatch: 93, slot: "home" }, 82: { nextMatch: 93, slot: "away" }, // R16 M5: USA vs BEL
  83: { nextMatch: 94, slot: "home" }, 84: { nextMatch: 94, slot: "away" }, // R16 M6: POR/CRO vs ESP/AUT
  85: { nextMatch: 95, slot: "home" }, 87: { nextMatch: 95, slot: "away" }, // R16 M7: SUI vs COL
  86: { nextMatch: 96, slot: "home" }, 88: { nextMatch: 96, slot: "away" }, // R16 M8: ARG vs AUS
  // R16 → QF (sequential per seed)
  89: { nextMatch: 97, slot: "home" }, 90: { nextMatch: 97, slot: "away" }, // QF M1
  91: { nextMatch: 98, slot: "home" }, 92: { nextMatch: 98, slot: "away" }, // QF M2
  93: { nextMatch: 99, slot: "home" }, 94: { nextMatch: 99, slot: "away" }, // QF M3
  95: { nextMatch: 100, slot: "home" }, 96: { nextMatch: 100, slot: "away" }, // QF M4
  // QF → SF (sequential per seed)
  97: { nextMatch: 101, slot: "home" }, 98: { nextMatch: 101, slot: "away" }, // SF M1
  99: { nextMatch: 102, slot: "home" }, 100: { nextMatch: 102, slot: "away" }, // SF M2
  // SF → Final
  101: { nextMatch: 104, slot: "home" }, 102: { nextMatch: 104, slot: "away" },
};

async function propagateKnockoutWinners(): Promise<number> {
  const finishedKnockout = await prisma.match.findMany({
    where: { stage: { not: "GROUP" }, status: "FINISHED", winnerId: { not: null } },
    select: { id: true, matchNumber: true, teamAId: true, teamBId: true, winnerId: true },
  });
  if (finishedKnockout.length === 0) return 0;

  // Collect all next-match numbers we need to update
  const nextMatchNums = new Set<number>();
  for (const m of finishedKnockout) {
    const next = BRACKET_NEXT[m.matchNumber!];
    if (next) nextMatchNums.add(next.nextMatch);
    // SF losers go to 3rd place match 103
    if (m.matchNumber === 101 || m.matchNumber === 102) nextMatchNums.add(103);
  }

  const targets = await prisma.match.findMany({
    where: { matchNumber: { in: [...nextMatchNums] } },
    select: { id: true, matchNumber: true, teamAId: true, teamBId: true, status: true },
  });
  const targetByNum = new Map(targets.map(t => [t.matchNumber!, t]));

  // Load team names for labels
  const teamIds = new Set<string>();
  for (const m of finishedKnockout) {
    if (m.winnerId) teamIds.add(m.winnerId);
    if (m.teamAId) teamIds.add(m.teamAId);
    if (m.teamBId) teamIds.add(m.teamBId);
  }
  const teams = await prisma.team.findMany({
    where: { id: { in: [...teamIds] } },
    select: { id: true, name: true },
  });
  const teamName = new Map(teams.map(t => [t.id, t.name]));

  let propagated = 0;

  for (const m of finishedKnockout) {
    // Winner → next bracket slot
    const next = BRACKET_NEXT[m.matchNumber!];
    if (next && m.winnerId) {
      const target = targetByNum.get(next.nextMatch);
      if (target) {
        const name = teamName.get(m.winnerId) ?? `W${m.matchNumber}`;
        const alreadySet = next.slot === "home" ? target.teamAId === m.winnerId
                                                 : target.teamBId === m.winnerId;
        if (!alreadySet) {
          // If a wrongly-assigned team pair was accidentally scored (e.g. a group-stage
          // result matched against a future knockout slot), clear the stale score.
          const staleScore = target.status === "FINISHED" || target.status === "LIVE";
          await prisma.match.update({
            where: { id: target.id },
            data: {
              ...(next.slot === "home"
                ? { teamAId: m.winnerId, teamALabel: name }
                : { teamBId: m.winnerId, teamBLabel: name }),
              ...(staleScore ? { status: "SCHEDULED", scoreA: null, scoreB: null, winnerId: null } : {}),
            },
          });
          propagated++;
        }
      }
    }

    // SF losers → 3rd place match (103)
    if ((m.matchNumber === 101 || m.matchNumber === 102) && m.winnerId) {
      const loserId = m.teamAId === m.winnerId ? m.teamBId : m.teamAId;
      if (loserId) {
        const target = targetByNum.get(103);
        if (target) {
          const name = teamName.get(loserId) ?? `L${m.matchNumber}`;
          const slot = m.matchNumber === 101 ? "home" : "away";
          const alreadySet = slot === "home" ? target.teamAId === loserId
                                             : target.teamBId === loserId;
          if (!alreadySet) {
            await prisma.match.update({
              where: { id: target.id },
              data: slot === "home"
                ? { teamAId: loserId, teamALabel: name }
                : { teamBId: loserId, teamBLabel: name },
            });
            propagated++;
          }
        }
      }
    }
  }

  return propagated;
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

  const knockoutAssigned = await propagateKnockoutWinners();

  return {
    scoresUpdated,
    kickoffsFixed,
    knockoutAssigned,
    checked: allEvents.length,
    unseenFdStages: [],
  };
}
