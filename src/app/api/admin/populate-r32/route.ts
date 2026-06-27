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

// WC2026 R32 bracket formulas in match order (matches 73–88), sourced from Wikipedia.
//
// Matches 74, 77, 81 use fixed rank-3 slots (confirmed real results: Germany–Paraguay,
// France–Sweden, USA–Bosnia). Using "best3rd" for these caused the greedy to swap them
// because Sweden (3rd F) ranks higher globally than Paraguay (3rd D) and F appears in
// both the Match 74 pool and Match 77 pool.
//
// The five remaining dynamic best3rd slots use the NARROWED pools that Wikipedia shows
// as common across all currently possible Annex C combinations.
const R32_FORMULAS: Array<{ home: TeamSpec; away: TeamSpec }> = [
  // Match 73: 2nd A vs 2nd B
  { home: { kind: "fixed", rank: 2, group: "A" }, away: { kind: "fixed", rank: 2, group: "B" } },
  // Match 74: 1st E vs 3rd D  (Germany vs Paraguay — fixed, not greedy)
  { home: { kind: "fixed", rank: 1, group: "E" }, away: { kind: "fixed", rank: 3, group: "D" } },
  // Match 75: 1st F vs 2nd C
  { home: { kind: "fixed", rank: 1, group: "F" }, away: { kind: "fixed", rank: 2, group: "C" } },
  // Match 76: 1st C vs 2nd F
  { home: { kind: "fixed", rank: 1, group: "C" }, away: { kind: "fixed", rank: 2, group: "F" } },
  // Match 77: 1st I vs 3rd F  (France vs Sweden — fixed, not greedy)
  { home: { kind: "fixed", rank: 1, group: "I" }, away: { kind: "fixed", rank: 3, group: "F" } },
  // Match 78: 2nd E vs 2nd I
  { home: { kind: "fixed", rank: 2, group: "E" }, away: { kind: "fixed", rank: 2, group: "I" } },
  // Match 79: 1st A vs best3rd(C/E/H/I) — original pool {C/E/F/H/I} minus F (committed to M77)
  { home: { kind: "fixed", rank: 1, group: "A" }, away: { kind: "best3rd", groups: ["C", "E", "H", "I"] } },
  // Match 80: 1st L vs best3rd(E/H/I/J/K) — original pool, no committed groups
  { home: { kind: "fixed", rank: 1, group: "L" }, away: { kind: "best3rd", groups: ["E", "H", "I", "J", "K"] } },
  // Match 81: 1st D vs 3rd B  (USA vs Bosnia — fixed, not greedy)
  { home: { kind: "fixed", rank: 1, group: "D" }, away: { kind: "fixed", rank: 3, group: "B" } },
  // Match 82: 1st G vs best3rd(A/E/H/I/J) — original pool, no committed groups
  { home: { kind: "fixed", rank: 1, group: "G" }, away: { kind: "best3rd", groups: ["A", "E", "H", "I", "J"] } },
  // Match 83: 2nd K vs 2nd L
  { home: { kind: "fixed", rank: 2, group: "K" }, away: { kind: "fixed", rank: 2, group: "L" } },
  // Match 84: 1st H vs 2nd J
  { home: { kind: "fixed", rank: 1, group: "H" }, away: { kind: "fixed", rank: 2, group: "J" } },
  // Match 85: 1st B vs best3rd(E/G/I/J) — original pool {E/F/G/I/J} minus F (committed to M77)
  { home: { kind: "fixed", rank: 1, group: "B" }, away: { kind: "best3rd", groups: ["E", "G", "I", "J"] } },
  // Match 86: 1st J vs 2nd H  (Argentina vs Cape Verde)
  { home: { kind: "fixed", rank: 1, group: "J" }, away: { kind: "fixed", rank: 2, group: "H" } },
  // Match 87: 1st K vs best3rd(E/I/J/L) — original pool {D/E/I/J/L} minus D (committed to M74)
  { home: { kind: "fixed", rank: 1, group: "K" }, away: { kind: "best3rd", groups: ["E", "I", "J", "L"] } },
  // Match 88: 2nd D vs 2nd G
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
  assignedBest3rd: Set<string>,
  fullyFinishedGroups: Set<string>
): TeamInfo | null {
  if (spec.kind === "fixed") {
    return byGroupRank.get(`${spec.group}-${spec.rank}`) ?? null;
  }
  // Only assign when every group in the pool has finished all its matches
  const poolReady = spec.groups.every((g) => fullyFinishedGroups.has(g));
  if (!poolReady) return null;

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

  // Determine which groups are fully finished (all 6 matches done)
  const allGroupMatches = await prisma.match.findMany({
    where: { stage: "GROUP" },
    select: { group: true, status: true, teamAId: true, teamBId: true, scoreA: true, scoreB: true },
  });

  const groupMatchCount = new Map<string, number>();
  const groupFinishedCount = new Map<string, number>();
  for (const m of allGroupMatches) {
    if (!m.group) continue;
    groupMatchCount.set(m.group, (groupMatchCount.get(m.group) ?? 0) + 1);
    if (m.status === "FINISHED") {
      groupFinishedCount.set(m.group, (groupFinishedCount.get(m.group) ?? 0) + 1);
    }
  }
  const fullyFinishedGroups = new Set<string>();
  for (const [group, total] of groupMatchCount) {
    if ((groupFinishedCount.get(group) ?? 0) >= total) {
      fullyFinishedGroups.add(group);
    }
  }

  // Compute per-team stats (only from fully finished groups)
  const statsMap = new Map<string, { pts: number; gd: number; gf: number }>();
  for (const t of allTeams) statsMap.set(t.id, { pts: 0, gd: 0, gf: 0 });

  for (const m of allGroupMatches) {
    if (!m.group || !fullyFinishedGroups.has(m.group)) continue;
    if (!m.teamAId || !m.teamBId || m.scoreA === null || m.scoreB === null) continue;
    if (m.status !== "FINISHED") continue;
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

  // Rank teams within each fully finished group only
  const teamsByGroup = new Map<string, typeof allTeams>();
  for (const t of allTeams) {
    if (!teamsByGroup.has(t.group)) teamsByGroup.set(t.group, []);
    teamsByGroup.get(t.group)!.push(t);
  }

  const byGroupRank = new Map<string, TeamInfo>();
  const thirdsByGroup = new Map<string, TeamInfo>();

  for (const [group, teams] of teamsByGroup) {
    if (!fullyFinishedGroups.has(group)) continue; // skip incomplete groups
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

  // Fetch FD schedule once — used to correct kickoff times after team assignment.
  // Failures here are non-fatal; teams will still be assigned.
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  let fdByTeamPair = new Map<string, { utcDate: string; venue: string | null }>();
  if (apiKey) {
    try {
      const fdRes = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
        headers: { "X-Auth-Token": apiKey },
        cache: "no-store",
      });
      if (fdRes.ok) {
        const { matches: fdMatches } = (await fdRes.json()) as {
          matches: Array<{ utcDate: string; stage: string; venue: string | null; homeTeam: { tla: string }; awayTeam: { tla: string } }>;
        };
        for (const m of fdMatches) {
          const h = (m.homeTeam?.tla ?? "").toUpperCase();
          const a = (m.awayTeam?.tla ?? "").toUpperCase();
          if (!h || !a) continue;
          const entry = { utcDate: m.utcDate, venue: m.venue };
          fdByTeamPair.set(`${h}-${a}`, entry);
          fdByTeamPair.set(`${a}-${h}`, entry);
        }
      }
    } catch {
      // non-fatal
    }
  }

  // Tracks all team IDs already assigned (fixed or best3rd) so the greedy
  // doesn't double-assign a 3rd-place team that was already committed via a fixed slot.
  const assignedBest3rd = new Set<string>();
  let assigned = 0;
  let kickoffsFixed = 0;
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

    const homeTeam = resolveSpec(formula.home, byGroupRank, thirdsByGroup, assignedBest3rd, fullyFinishedGroups);
    const awayTeam = resolveSpec(formula.away, byGroupRank, thirdsByGroup, assignedBest3rd, fullyFinishedGroups);

    // Register any fixed rank-3 assignment so the greedy pools exclude it
    if (formula.away.kind === "fixed" && formula.away.rank === 3 && awayTeam) {
      assignedBest3rd.add(awayTeam.id);
    }

    const homeLabel = specLabel(formula.home, homeTeam);
    const awayLabel = specLabel(formula.away, awayTeam);

    // Look up the correct kickoff from FD if both teams are known
    const updateData: {
      teamAId: string | null;
      teamBId: string | null;
      teamALabel: string;
      teamBLabel: string;
      kickoff?: Date;
      venue?: string;
    } = {
      teamAId: homeTeam?.id ?? null,
      teamBId: awayTeam?.id ?? null,
      teamALabel: homeLabel,
      teamBLabel: awayLabel,
    };

    if (homeTeam && awayTeam) {
      const fdEntry =
        fdByTeamPair.get(`${homeTeam.code}-${awayTeam.code}`) ??
        fdByTeamPair.get(`${awayTeam.code}-${homeTeam.code}`);
      if (fdEntry) {
        updateData.kickoff = new Date(fdEntry.utcDate);
        if (fdEntry.venue) updateData.venue = fdEntry.venue;
        kickoffsFixed++;
      }
    }

    await prisma.match.update({ where: { id: slot.id }, data: updateData });

    if (homeTeam && awayTeam) assigned++;
    details.push(`#${slot.matchNumber}: ${homeLabel} vs ${awayLabel}`);
  }

  const incompleteGroups = [...groupMatchCount.keys()]
    .filter((g) => !fullyFinishedGroups.has(g))
    .sort();

  // Build global 3rd-place ranking for visibility
  const thirdPlaceRanking = [...thirdsByGroup.values()]
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
    .map((t, i) => ({
      rank: i + 1,
      group: t.group,
      name: t.name,
      pts: t.pts,
      gd: t.gd,
      gf: t.gf,
    }));

  return NextResponse.json({ assigned, kickoffsFixed, skipped, details, incompleteGroups, thirdPlaceRanking });
}
