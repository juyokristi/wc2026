import { prisma } from "@/lib/prisma";
import { calculatePoints } from "@/lib/scoring";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";

const WC_START_STR = "2026-06-11";
const WC_END_STR   = "2026-07-19";

// ESPN season.slug → our DB stage value
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

// BRACKET_NEXT is kept as a fallback only for cases where ESPN hasn't yet
// confirmed the next-round pairing (e.g. team won R32 but R16 slot still shows RD32 on ESPN).
const BRACKET_NEXT: Record<number, { nextMatch: number; slot: "home" | "away" }> = {
  73: { nextMatch: 89, slot: "home" }, 75: { nextMatch: 89, slot: "away" },
  76: { nextMatch: 90, slot: "home" }, 78: { nextMatch: 90, slot: "away" },
  74: { nextMatch: 91, slot: "home" }, 77: { nextMatch: 91, slot: "away" },
  79: { nextMatch: 92, slot: "home" }, 80: { nextMatch: 92, slot: "away" },
  81: { nextMatch: 93, slot: "home" }, 82: { nextMatch: 93, slot: "away" },
  83: { nextMatch: 94, slot: "home" }, 84: { nextMatch: 94, slot: "away" },
  85: { nextMatch: 95, slot: "home" }, 87: { nextMatch: 95, slot: "away" },
  86: { nextMatch: 96, slot: "home" }, 88: { nextMatch: 96, slot: "away" },
  89: { nextMatch: 97, slot: "home" }, 90: { nextMatch: 97, slot: "away" },
  91: { nextMatch: 98, slot: "home" }, 92: { nextMatch: 98, slot: "away" },
  93: { nextMatch: 99, slot: "home" }, 94: { nextMatch: 99, slot: "away" },
  95: { nextMatch: 100, slot: "home" }, 96: { nextMatch: 100, slot: "away" },
  97: { nextMatch: 101, slot: "home" }, 98: { nextMatch: 101, slot: "away" },
  99: { nextMatch: 102, slot: "home" }, 100: { nextMatch: 102, slot: "away" },
  101: { nextMatch: 104, slot: "home" }, 102: { nextMatch: 104, slot: "away" },
};

async function propagateKnockoutWinners(): Promise<number> {
  const finishedKnockout = await prisma.match.findMany({
    where: { stage: { not: "GROUP" }, status: "FINISHED", winnerId: { not: null } },
    select: { id: true, matchNumber: true, teamAId: true, teamBId: true, winnerId: true },
  });
  if (finishedKnockout.length === 0) return 0;

  const nextMatchNums = new Set<number>();
  for (const m of finishedKnockout) {
    const next = BRACKET_NEXT[m.matchNumber!];
    if (next) nextMatchNums.add(next.nextMatch);
    if (m.matchNumber === 101 || m.matchNumber === 102) nextMatchNums.add(103);
  }

  const targets = await prisma.match.findMany({
    where: { matchNumber: { in: [...nextMatchNums] } },
    select: { id: true, matchNumber: true, teamAId: true, teamBId: true, status: true },
  });
  const targetByNum = new Map(targets.map(t => [t.matchNumber!, t]));

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
    const next = BRACKET_NEXT[m.matchNumber!];
    if (next && m.winnerId) {
      const target = targetByNum.get(next.nextMatch);
      if (target) {
        const name = teamName.get(m.winnerId) ?? `W${m.matchNumber}`;
        const alreadySet = next.slot === "home" ? target.teamAId === m.winnerId
                                                 : target.teamBId === m.winnerId;
        if (!alreadySet) {
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

// Uses ESPN's confirmed bracket data as the source of truth for knockout slots.
// Matches by kickoff time (±30 min) so it's independent of matchNumbers or team codes.
// Also detects and clears stale scores in slots that have the wrong teams.
async function assignKnockoutTeamsFromEspn(allEvents: EspnEvent[]): Promise<number> {
  const knockoutSlots = await prisma.match.findMany({
    where: { stage: { not: "GROUP" } },
    select: {
      id: true, stage: true, kickoff: true, status: true,
      teamAId: true, teamBId: true,
      teamA: { select: { code: true } },
      teamB: { select: { code: true } },
    },
  });

  const allTeams = await prisma.team.findMany({ select: { id: true, code: true } });
  const teamByCode = new Map(allTeams.map(t => [t.code.toUpperCase(), t.id]));

  let changed = 0;

  for (const event of allEvents) {
    const slug = event.season?.slug ?? "";
    const dbStage = ESPN_SLUG_TO_STAGE[slug];
    if (!dbStage || dbStage === "GROUP") continue;

    const comp = event.competitions[0];
    if (!comp) continue;

    const homeComp = comp.competitors.find(c => c.homeAway === "home");
    const awayComp = comp.competitors.find(c => c.homeAway === "away");
    if (!homeComp || !awayComp) continue;

    const espnHome = homeComp.team.abbreviation.toUpperCase(); // "RD32" if TBD
    const espnAway = awayComp.team.abbreviation.toUpperCase();

    // Match DB slot by stage + kickoff time (±30 min)
    const eventMs = new Date(event.date).getTime();
    const slot = knockoutSlots.find(s =>
      s.stage === dbStage &&
      Math.abs(s.kickoff.getTime() - eventMs) <= 30 * 60 * 1000
    );
    if (!slot) continue;

    const dbHome = slot.teamA?.code?.toUpperCase() ?? null;
    const dbAway = slot.teamB?.code?.toUpperCase() ?? null;

    // Determine whether ESPN's assignment matches what's in the DB
    const homeOk = espnHome === "RD32" || dbHome === espnHome;
    const awayOk = espnAway === "RD32" || dbAway === espnAway;

    if (slot.status === "FINISHED" || slot.status === "LIVE") {
      if (homeOk && awayOk) continue; // correct teams, real result — don't touch
      // Wrong teams accumulated a stale score — wipe it so we can reassign
      await prisma.match.update({
        where: { id: slot.id },
        data: { status: "SCHEDULED", scoreA: null, scoreB: null, winnerId: null },
      });
      slot.status = "SCHEDULED";
      changed++;
    }

    const updates: Record<string, string | null> = {};
    if (espnHome !== "RD32" && !homeOk) {
      const teamId = teamByCode.get(espnHome);
      if (teamId) { updates.teamAId = teamId; updates.teamALabel = null; }
    }
    if (espnAway !== "RD32" && !awayOk) {
      const teamId = teamByCode.get(espnAway);
      if (teamId) { updates.teamBId = teamId; updates.teamBLabel = null; }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.match.update({ where: { id: slot.id }, data: updates });
      changed++;
    }
  }

  return changed;
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

  // Step 1: Fix knockout slot assignments directly from ESPN bracket data.
  // This runs first so that the subsequent score-sync step sees the correct teams.
  const espnAssigned = await assignKnockoutTeamsFromEspn(allEvents);

  // Step 2: Reload matches (reflects any team assignments made in step 1),
  // keyed by STAGE:codeA-codeB so a group-stage result can never match a
  // knockout slot even if the same two teams happen to appear in both.
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

  for (const event of allEvents) {
    const comp = event.competitions[0];
    if (!comp) continue;

    const homeComp = comp.competitors.find((c) => c.homeAway === "home");
    const awayComp = comp.competitors.find((c) => c.homeAway === "away");
    if (!homeComp || !awayComp) continue;

    const homeCode = homeComp.team.abbreviation.toUpperCase();
    const awayCode = awayComp.team.abbreviation.toUpperCase();
    if (homeCode === "RD32" || awayCode === "RD32") continue; // TBD teams — skip

    const slug = event.season?.slug ?? "";
    const dbStage = ESPN_SLUG_TO_STAGE[slug];
    if (!dbStage) continue;

    const m = byTeamPair.get(`${dbStage}:${homeCode}-${awayCode}`);
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
        data: { scoreA, scoreB, status: "FINISHED", kickoff, ...(winnerId ? { winnerId } : {}) },
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

  // Step 3: fallback propagation for cases ESPN hasn't confirmed yet
  const propagated = await propagateKnockoutWinners();

  return {
    scoresUpdated,
    kickoffsFixed,
    knockoutAssigned: espnAssigned + propagated,
    checked: allEvents.length,
    unseenFdStages: [],
  };
}
