import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rebuildBracket } from "@/lib/bracket";

const FD_BASE = "https://api.football-data.org/v4";

const FD_STAGE_MAP: Record<string, string> = {
  LAST_32:       "ROUND_OF_32",
  LAST_16:       "ROUND_OF_16",
  QUARTER_FINALS: "QUARTER_FINAL",
  SEMI_FINALS:   "SEMI_FINAL",
  THIRD_PLACE:   "THIRD_PLACE",
  FINAL:         "FINAL",
};

const TLA_MAP: Record<string, string> = { URY: "URU" };

function normTla(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const up = raw.toUpperCase();
  if (up === "TBD" || up === "") return null;
  return TLA_MAP[up] ?? up;
}

// Syncs all confirmed knockout team assignments from football-data.org into the DB,
// matching each FD match to a DB slot by stage + kickoff time (±30 min window).
// Overwrites any wrong team currently in SCHEDULED slots.
// Resets stale scores and prediction pointsEarned when teams change.
// Then calls rebuildBracket() to propagate finished-match winners into future slots.
export async function POST() {
  const session = await auth();
  if (!session?.user?.email || session.user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No FOOTBALL_DATA_API_KEY" }, { status: 500 });

  const res = await fetch(`${FD_BASE}/competitions/WC/matches`, {
    headers: { "X-Auth-Token": apiKey },
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ error: `FD API error: ${res.status}` }, { status: 500 });
  }

  const { matches: fdMatches } = (await res.json()) as {
    matches: Array<{
      utcDate: string;
      status: string;
      stage: string;
      homeTeam: { tla: string | null };
      awayTeam: { tla: string | null };
    }>;
  };

  const fdKnockout = fdMatches.filter((m) => FD_STAGE_MAP[m.stage]);

  const dbSlots = await prisma.match.findMany({
    where: { stage: { not: "GROUP" } },
    select: {
      id: true,
      matchNumber: true,
      stage: true,
      kickoff: true,
      status: true,
      teamAId: true,
      teamBId: true,
      scoreA: true,
      scoreB: true,
    },
  });

  const allTeams = await prisma.team.findMany({ select: { id: true, code: true } });
  const teamByCode = new Map(allTeams.map((t) => [t.code.toUpperCase(), t.id]));

  let teamsAssigned = 0;
  let kickoffsUpdated = 0;
  const unmatched: string[] = [];
  const missingCodes: string[] = [];

  for (const fd of fdKnockout) {
    const dbStage = FD_STAGE_MAP[fd.stage];
    const fdTime = new Date(fd.utcDate);

    // Match DB slot by stage + kickoff within ±30 min
    const slot = dbSlots.find(
      (s) =>
        s.stage === dbStage &&
        Math.abs(s.kickoff.getTime() - fdTime.getTime()) <= 30 * 60 * 1000
    );

    if (!slot) {
      unmatched.push(`${fd.stage} @ ${fd.utcDate}`);
      continue;
    }

    // Never overwrite a match that's in progress or completed
    if (slot.status === "FINISHED" || slot.status === "LIVE") continue;

    const homeTla = normTla(fd.homeTeam?.tla);
    const awayTla = normTla(fd.awayTeam?.tla);

    const homeId = homeTla ? (teamByCode.get(homeTla) ?? null) : null;
    const awayId = awayTla ? (teamByCode.get(awayTla) ?? null) : null;

    if (homeTla && !homeId) missingCodes.push(homeTla);
    if (awayTla && !awayId) missingCodes.push(awayTla);

    const homeChanging = homeId !== null && homeId !== slot.teamAId;
    const awayChanging = awayId !== null && awayId !== slot.teamBId;
    const kickoffChanging = Math.abs(slot.kickoff.getTime() - fdTime.getTime()) > 60_000;

    if (!homeChanging && !awayChanging && !kickoffChanging) continue;

    const teamsChanging = homeChanging || awayChanging;
    const hasStaleScore = slot.scoreA !== null || slot.scoreB !== null;

    if (teamsChanging && hasStaleScore) {
      await prisma.prediction.updateMany({
        where: { matchId: slot.id },
        data: { pointsEarned: null },
      });
    }

    await prisma.match.update({
      where: { id: slot.id },
      data: {
        ...(kickoffChanging ? { kickoff: fdTime } : {}),
        ...(homeId && homeChanging ? { teamAId: homeId, teamALabel: null } : {}),
        ...(awayId && awayChanging ? { teamBId: awayId, teamBLabel: null } : {}),
        ...(teamsChanging && hasStaleScore
          ? { status: "SCHEDULED", scoreA: null, scoreB: null, winnerId: null }
          : {}),
      },
    });

    if (kickoffChanging) kickoffsUpdated++;
    if (teamsChanging) teamsAssigned++;
  }

  // Propagate finished-match winners into future slots and recompute all labels
  const { assigned: bracketAssigned, labelsUpdated } = await rebuildBracket();

  return NextResponse.json({
    teamsAssigned,
    kickoffsUpdated,
    bracketAssigned,
    labelsUpdated,
    unmatched,
    missingCodes: [...new Set(missingCodes)],
  });
}
