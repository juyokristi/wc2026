import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const FD_BASE = "https://api.football-data.org/v4";

const FD_STAGE_MAP: Record<string, string> = {
  LAST_32: "ROUND_OF_32",
  ROUND_OF_32: "ROUND_OF_32",
  LAST_16: "ROUND_OF_16",
  ROUND_OF_16: "ROUND_OF_16",
  QUARTER_FINALS: "QUARTER_FINAL",
  QUARTER_FINAL: "QUARTER_FINAL",
  SEMI_FINALS: "SEMI_FINAL",
  SEMI_FINAL: "SEMI_FINAL",
  THIRD_PLACE: "THIRD_PLACE",
  FINAL: "FINAL",
};

const TLA_MAP: Record<string, string> = { URY: "URU" };

function normalizeTla(tla: string): string {
  return TLA_MAP[tla] ?? tla;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email || session.user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  const res = await fetch(`${FD_BASE}/competitions/WC/matches`, {
    headers: { "X-Auth-Token": apiKey },
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ error: `FD API error: ${res.status}` }, { status: 500 });

  const { matches } = (await res.json()) as {
    matches: Array<{
      utcDate: string;
      status: string;
      stage: string;
      homeTeam: { tla: string; name: string };
      awayTeam: { tla: string; name: string };
    }>;
  };

  const allTeams = await prisma.team.findMany({ select: { id: true, code: true } });
  const teamByCode = new Map(allTeams.map((t) => [t.code, t.id]));

  const ourMatches = await prisma.match.findMany({
    where: { teamAId: { not: null }, teamBId: { not: null } },
    include: { teamA: { select: { code: true } }, teamB: { select: { code: true } } },
  });
  const byTeamPair = new Map<string, boolean>();
  for (const m of ourMatches) {
    if (m.teamA && m.teamB) {
      byTeamPair.set(`${m.teamA.code}-${m.teamB.code}`, true);
      byTeamPair.set(`${m.teamB.code}-${m.teamA.code}`, true);
    }
  }

  const knockoutPending = await prisma.match.findMany({
    where: { stage: { not: "GROUP" }, OR: [{ teamAId: null }, { teamBId: null }] },
    select: { id: true, kickoff: true, stage: true, teamALabel: true, teamBLabel: true },
    orderBy: [{ stage: "asc" }, { kickoff: "asc" }],
  });

  const nonGroupFd = matches.filter((m) => {
    const s = m.stage ?? "";
    return s !== "GROUP_STAGE" && s !== "GROUP" && s !== "PRELIMINARY_ROUND";
  });

  const fdRows = nonGroupFd.map((m) => {
    const rawHome = m.homeTeam?.tla?.toUpperCase() ?? "";
    const rawAway = m.awayTeam?.tla?.toUpperCase() ?? "";
    const homeTla = normalizeTla(rawHome);
    const awayTla = normalizeTla(rawAway);
    const isTbd = !homeTla || !awayTla || homeTla === "TBD" || awayTla === "TBD";
    const alreadyAssigned = !isTbd && byTeamPair.has(`${homeTla}-${awayTla}`);
    const homeInDb = !isTbd && teamByCode.has(homeTla);
    const awayInDb = !isTbd && teamByCode.has(awayTla);
    return {
      fdStage: m.stage,
      dbStage: FD_STAGE_MAP[m.stage] ?? null,
      homeTla: homeTla || "(blank)",
      awayTla: awayTla || "(blank)",
      homeName: m.homeTeam?.name,
      awayName: m.awayTeam?.name,
      status: m.status,
      utcDate: m.utcDate,
      isTbd,
      alreadyAssigned,
      homeInDb,
      awayInDb,
      isCandidate: !isTbd && !alreadyAssigned && homeInDb && awayInDb,
      issue: isTbd
        ? "TBD"
        : alreadyAssigned
        ? "already_in_db"
        : !homeInDb || !awayInDb
        ? `missing_code:${!homeInDb ? homeTla : ""}${!homeInDb && !awayInDb ? "+" : ""}${!awayInDb ? awayTla : ""}`
        : "ok",
    };
  });

  const pendingByStage = knockoutPending.reduce<Record<string, number>>((acc, s) => {
    acc[s.stage] = (acc[s.stage] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    summary: {
      totalFdNonGroup: fdRows.length,
      tbd: fdRows.filter((r) => r.isTbd).length,
      alreadyAssigned: fdRows.filter((r) => r.alreadyAssigned).length,
      candidates: fdRows.filter((r) => r.isCandidate).length,
      missingCodes: fdRows.filter((r) => !r.isTbd && !r.alreadyAssigned && (!r.homeInDb || !r.awayInDb)).length,
    },
    pendingDbSlots: pendingByStage,
    candidates: fdRows.filter((r) => r.isCandidate),
    missingCodes: fdRows.filter((r) => !r.isTbd && !r.alreadyAssigned && (!r.homeInDb || !r.awayInDb)),
    tbd: fdRows.filter((r) => r.isTbd),
  });
}
