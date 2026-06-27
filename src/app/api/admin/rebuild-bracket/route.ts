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

function rankLabel(rank: number): string {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

async function computeGroupStandings(): Promise<Map<string, { rank: number; group: string }>> {
  const allTeams = await prisma.team.findMany({ select: { id: true, group: true } });
  const finishedMatches = await prisma.match.findMany({
    where: { stage: "GROUP", status: "FINISHED" },
    select: { teamAId: true, teamBId: true, scoreA: true, scoreB: true },
  });

  const stats = new Map<string, { pts: number; gd: number; gf: number; group: string }>();
  for (const t of allTeams) {
    stats.set(t.id, { pts: 0, gd: 0, gf: 0, group: t.group ?? "" });
  }

  for (const m of finishedMatches) {
    if (!m.teamAId || !m.teamBId || m.scoreA === null || m.scoreB === null) continue;
    const a = stats.get(m.teamAId)!;
    const b = stats.get(m.teamBId)!;
    if (m.scoreA > m.scoreB) { a.pts += 3; }
    else if (m.scoreA < m.scoreB) { b.pts += 3; }
    else { a.pts += 1; b.pts += 1; }
    a.gd += m.scoreA - m.scoreB;
    a.gf += m.scoreA;
    b.gd += m.scoreB - m.scoreA;
    b.gf += m.scoreB;
  }

  const byGroup = new Map<string, Array<{ id: string; pts: number; gd: number; gf: number }>>();
  for (const [id, s] of stats) {
    if (!s.group) continue;
    if (!byGroup.has(s.group)) byGroup.set(s.group, []);
    byGroup.get(s.group)!.push({ id, pts: s.pts, gd: s.gd, gf: s.gf });
  }

  const result = new Map<string, { rank: number; group: string }>();
  for (const [group, teams] of byGroup) {
    teams.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    teams.forEach((t, i) => result.set(t.id, { rank: i + 1, group }));
  }
  return result;
}

export async function POST() {
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

  const { matches: fdMatches } = (await res.json()) as {
    matches: Array<{
      utcDate: string;
      status: string;
      stage: string;
      venue: string | null;
      homeTeam: { tla: string };
      awayTeam: { tla: string };
    }>;
  };

  const allTeams = await prisma.team.findMany({ select: { id: true, code: true } });
  const teamByCode = new Map(allTeams.map((t) => [t.code, t.id]));

  const standings = await computeGroupStandings();

  const knockoutSlots = await prisma.match.findMany({
    where: { stage: { not: "GROUP" } },
    select: { id: true, kickoff: true, stage: true, teamAId: true, teamBId: true, matchNumber: true },
    orderBy: { kickoff: "asc" },
  });

  // Group DB slots by stage, sorted by kickoff
  const dbByStage = new Map<string, typeof knockoutSlots>();
  for (const s of knockoutSlots) {
    if (!dbByStage.has(s.stage)) dbByStage.set(s.stage, []);
    dbByStage.get(s.stage)!.push(s);
  }

  // Group FD non-group matches by mapped DB stage
  const fdByDbStage = new Map<string, typeof fdMatches>();
  const unseenStages = new Set<string>();
  for (const m of fdMatches) {
    const s = m.stage ?? "";
    if (s === "GROUP_STAGE" || s === "GROUP" || s === "PRELIMINARY_ROUND") continue;
    const dbStage = FD_STAGE_MAP[s];
    if (!dbStage) { unseenStages.add(s); continue; }
    if (!fdByDbStage.has(dbStage)) fdByDbStage.set(dbStage, []);
    fdByDbStage.get(dbStage)!.push(m);
  }

  let kickoffsUpdated = 0;
  let teamsAssigned = 0;
  const stageSummary: Record<string, { fdCount: number; dbCount: number; updated: number }> = {};

  for (const [dbStage, fdList] of fdByDbStage) {
    const dbList = dbByStage.get(dbStage);
    if (!dbList?.length) continue;

    const sortedFd = [...fdList].sort(
      (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
    );
    const sortedDb = [...dbList].sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());

    stageSummary[dbStage] = { fdCount: sortedFd.length, dbCount: sortedDb.length, updated: 0 };

    for (let i = 0; i < Math.min(sortedFd.length, sortedDb.length); i++) {
      const fd = sortedFd[i];
      const db = sortedDb[i];

      const homeTla = normalizeTla(fd.homeTeam?.tla?.toUpperCase() ?? "");
      const awayTla = normalizeTla(fd.awayTeam?.tla?.toUpperCase() ?? "");
      const isTbd = !homeTla || !awayTla || homeTla === "TBD" || awayTla === "TBD";

      const updateData: {
        kickoff: Date;
        venue?: string;
        teamAId?: string;
        teamBId?: string;
        teamALabel?: string;
        teamBLabel?: string;
      } = { kickoff: new Date(fd.utcDate) };

      if (fd.venue) updateData.venue = fd.venue;

      // Only assign teams if the DB slot is currently empty
      if (!isTbd && !db.teamAId && !db.teamBId) {
        const homeId = teamByCode.get(homeTla);
        const awayId = teamByCode.get(awayTla);
        if (homeId && awayId) {
          updateData.teamAId = homeId;
          updateData.teamBId = awayId;

          const homeSt = standings.get(homeId);
          const awaySt = standings.get(awayId);
          if (homeSt) updateData.teamALabel = `${rankLabel(homeSt.rank)} Group ${homeSt.group}`;
          if (awaySt) updateData.teamBLabel = `${rankLabel(awaySt.rank)} Group ${awaySt.group}`;

          teamsAssigned++;
        }
      }

      await prisma.match.update({ where: { id: db.id }, data: updateData });
      kickoffsUpdated++;
      stageSummary[dbStage].updated++;
    }
  }

  return NextResponse.json({
    kickoffsUpdated,
    teamsAssigned,
    stageSummary,
    unseenFdStages: [...unseenStages],
  });
}
