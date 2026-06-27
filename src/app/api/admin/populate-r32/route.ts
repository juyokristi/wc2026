import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

interface TeamInfo {
  id: string;
  code: string;
  name: string;
  pts: number;
  gd: number;
  gf: number;
  group: string;
  rank: number;
}

type SpecFixed = { kind: "fixed"; rank: 1 | 2 | 3; group: string };
type SpecBest3rd = { kind: "best3rd"; groups: string[] };
type TeamSpec = SpecFixed | SpecBest3rd;

// WC2026 R32 bracket formulas in match order (chronological, matches 73–88)
// Verified against confirmed fixtures: France (1st I) vs Sweden (3rd F), Argentina (1st J) vs Cape Verde (3rd H)
const R32_FORMULAS: Array<{ home: TeamSpec; away: TeamSpec }> = [
  { home: { kind: "fixed", rank: 2, group: "A" }, away: { kind: "fixed", rank: 2, group: "B" } },
  { home: { kind: "fixed", rank: 1, group: "E" }, away: { kind: "fixed", rank: 3, group: "D" } },
  { home: { kind: "fixed", rank: 1, group: "F" }, away: { kind: "fixed", rank: 2, group: "C" } },
  { home: { kind: "fixed", rank: 1, group: "C" }, away: { kind: "fixed", rank: 2, group: "F" } },
  { home: { kind: "fixed", rank: 1, group: "I" }, away: { kind: "fixed", rank: 3, group: "F" } },
  { home: { kind: "fixed", rank: 2, group: "E" }, away: { kind: "fixed", rank: 2, group: "I" } },
  { home: { kind: "fixed", rank: 1, group: "A" }, away: { kind: "best3rd", groups: ["C", "E"] } },
  { home: { kind: "fixed", rank: 1, group: "L" }, away: { kind: "fixed", rank: 2, group: "H" } },
  { home: { kind: "fixed", rank: 1, group: "D" }, away: { kind: "fixed", rank: 3, group: "B" } },
  { home: { kind: "fixed", rank: 1, group: "G" }, away: { kind: "best3rd", groups: ["A", "I", "J"] } },
  { home: { kind: "fixed", rank: 2, group: "K" }, away: { kind: "fixed", rank: 2, group: "L" } },
  { home: { kind: "fixed", rank: 1, group: "H" }, away: { kind: "fixed", rank: 2, group: "J" } },
  { home: { kind: "fixed", rank: 1, group: "B" }, away: { kind: "best3rd", groups: ["G", "J"] } },
  { home: { kind: "fixed", rank: 1, group: "J" }, away: { kind: "fixed", rank: 3, group: "H" } },
  { home: { kind: "fixed", rank: 1, group: "K" }, away: { kind: "best3rd", groups: ["E", "I", "L"] } },
  { home: { kind: "fixed", rank: 2, group: "D" }, away: { kind: "fixed", rank: 2, group: "G" } },
];

function rankLabel(rank: number): string {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

function specLabel(spec: TeamSpec, team: TeamInfo | null): string {
  if (team) return `${rankLabel(team.rank)} Group ${team.group}`;
  if (spec.kind === "fixed") return `${rankLabel(spec.rank)} Group ${spec.group}`;
  return `Best 3rd (${spec.groups.join("/")})`;
}

function resolveSpec(
  spec: TeamSpec,
  byGroupRank: Map<string, TeamInfo>,
  thirdsByGroup: Map<string, TeamInfo>,
  assignedBest3rd: Set<string>
): TeamInfo | null {
  if (spec.kind === "fixed") {
    return byGroupRank.get(`${spec.group}-${spec.rank}`) ?? null;
  }
  const candidates = spec.groups
    .map((g) => thirdsByGroup.get(g))
    .filter((t): t is TeamInfo => !!t && !assignedBest3rd.has(t.id))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  if (candidates[0]) {
    assignedBest3rd.add(candidates[0].id);
    return candidates[0];
  }
  return null;
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.email || session.user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allTeams = await prisma.team.findMany({
    select: { id: true, code: true, name: true, group: true },
  });

  const finishedGroupMatches = await prisma.match.findMany({
    where: { stage: "GROUP", status: "FINISHED" },
    select: { teamAId: true, teamBId: true, scoreA: true, scoreB: true },
  });

  // Compute per-team stats
  const statsMap = new Map<string, { pts: number; gd: number; gf: number }>();
  for (const t of allTeams) statsMap.set(t.id, { pts: 0, gd: 0, gf: 0 });

  for (const m of finishedGroupMatches) {
    if (!m.teamAId || !m.teamBId || m.scoreA === null || m.scoreB === null) continue;
    const a = statsMap.get(m.teamAId)!;
    const b = statsMap.get(m.teamBId)!;
    if (m.scoreA > m.scoreB) { a.pts += 3; }
    else if (m.scoreA < m.scoreB) { b.pts += 3; }
    else { a.pts += 1; b.pts += 1; }
    a.gd += m.scoreA - m.scoreB;
    a.gf += m.scoreA;
    b.gd += m.scoreB - m.scoreA;
    b.gf += m.scoreB;
  }

  // Rank teams within each group
  const teamsByGroup = new Map<string, typeof allTeams>();
  for (const t of allTeams) {
    if (!teamsByGroup.has(t.group)) teamsByGroup.set(t.group, []);
    teamsByGroup.get(t.group)!.push(t);
  }

  const byGroupRank = new Map<string, TeamInfo>();
  const thirdsByGroup = new Map<string, TeamInfo>();

  for (const [group, teams] of teamsByGroup) {
    const ranked = teams
      .map((t) => {
        const s = statsMap.get(t.id) ?? { pts: 0, gd: 0, gf: 0 };
        return { ...t, ...s, group };
      })
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

    ranked.forEach((t, i) => {
      const info: TeamInfo = { ...t, rank: i + 1 };
      byGroupRank.set(`${group}-${i + 1}`, info);
      if (i === 2) thirdsByGroup.set(group, info);
    });
  }

  // Get the 16 R32 DB slots ordered by matchNumber
  const r32Slots = await prisma.match.findMany({
    where: { stage: "ROUND_OF_32" },
    orderBy: { matchNumber: "asc" },
    select: { id: true, matchNumber: true, status: true },
  });

  if (r32Slots.length !== 16) {
    return NextResponse.json(
      { error: `Expected 16 R32 slots, found ${r32Slots.length}` },
      { status: 500 }
    );
  }

  const assignedBest3rd = new Set<string>();
  let assigned = 0;
  let skipped = 0;
  const details: string[] = [];

  for (let i = 0; i < R32_FORMULAS.length; i++) {
    const slot = r32Slots[i];
    const formula = R32_FORMULAS[i];

    if (slot.status === "FINISHED" || slot.status === "LIVE") {
      skipped++;
      details.push(`#${slot.matchNumber}: skipped (${slot.status})`);
      continue;
    }

    const homeTeam = resolveSpec(formula.home, byGroupRank, thirdsByGroup, assignedBest3rd);
    const awayTeam = resolveSpec(formula.away, byGroupRank, thirdsByGroup, assignedBest3rd);

    const homeLabel = specLabel(formula.home, homeTeam);
    const awayLabel = specLabel(formula.away, awayTeam);

    await prisma.match.update({
      where: { id: slot.id },
      data: {
        teamAId: homeTeam?.id ?? null,
        teamBId: awayTeam?.id ?? null,
        teamALabel: homeLabel,
        teamBLabel: awayLabel,
      },
    });

    if (homeTeam && awayTeam) assigned++;
    details.push(`#${slot.matchNumber}: ${homeLabel} vs ${awayLabel}`);
  }

  return NextResponse.json({ assigned, skipped, details });
}
