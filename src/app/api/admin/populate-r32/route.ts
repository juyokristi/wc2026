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
// Pools confirmed from the actual bracket: https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_round_of_32
// kickoffUtc: hardcoded from the confirmed schedule — always applied regardless of FD state.
const R32_FORMULAS: Array<{ home: TeamSpec; away: TeamSpec; kickoffUtc: string; venue: string; city: string; country: string }> = [
  // Match 73 — Jun 28 19:00 UTC  (South Africa vs Canada)
  { home: { kind: "fixed", rank: 2, group: "A" }, away: { kind: "fixed", rank: 2, group: "B" },
    kickoffUtc: "2026-06-28T19:00:00Z", venue: "SoFi Stadium", city: "Inglewood", country: "USA" },
  // Match 74 — Jun 29 20:30 UTC  (Germany vs Paraguay)
  { home: { kind: "fixed", rank: 1, group: "E" }, away: { kind: "fixed", rank: 3, group: "D" },
    kickoffUtc: "2026-06-29T20:30:00Z", venue: "Gillette Stadium", city: "Foxborough", country: "USA" },
  // Match 75 — Jun 30 01:00 UTC  (Netherlands vs Morocco)
  { home: { kind: "fixed", rank: 1, group: "F" }, away: { kind: "fixed", rank: 2, group: "C" },
    kickoffUtc: "2026-06-30T01:00:00Z", venue: "Estadio BBVA", city: "Guadalupe", country: "Mexico" },
  // Match 76 — Jun 29 17:00 UTC  (Brazil vs Japan)
  { home: { kind: "fixed", rank: 1, group: "C" }, away: { kind: "fixed", rank: 2, group: "F" },
    kickoffUtc: "2026-06-29T17:00:00Z", venue: "NRG Stadium", city: "Houston", country: "USA" },
  // Match 77 — Jun 30 21:00 UTC  (France vs Sweden)
  { home: { kind: "fixed", rank: 1, group: "I" }, away: { kind: "fixed", rank: 3, group: "F" },
    kickoffUtc: "2026-06-30T21:00:00Z", venue: "MetLife Stadium", city: "East Rutherford", country: "USA" },
  // Match 78 — Jun 30 17:00 UTC  (Ivory Coast vs Norway)
  { home: { kind: "fixed", rank: 2, group: "E" }, away: { kind: "fixed", rank: 2, group: "I" },
    kickoffUtc: "2026-06-30T17:00:00Z", venue: "AT&T Stadium", city: "Arlington", country: "USA" },
  // Match 79 — Jul 01 01:00 UTC  (Mexico vs 3rd C/E)
  { home: { kind: "fixed", rank: 1, group: "A" }, away: { kind: "best3rd", groups: ["C", "E"] },
    kickoffUtc: "2026-07-01T01:00:00Z", venue: "Estadio Azteca", city: "Mexico City", country: "Mexico" },
  // Match 80 — Jul 01 16:00 UTC  (Winner L vs 3rd I/J/K)
  { home: { kind: "fixed", rank: 1, group: "L" }, away: { kind: "best3rd", groups: ["I", "J", "K"] },
    kickoffUtc: "2026-07-01T16:00:00Z", venue: "Mercedes-Benz Stadium", city: "Atlanta", country: "USA" },
  // Match 81 — Jul 02 00:00 UTC  (USA vs Bosnia)
  { home: { kind: "fixed", rank: 1, group: "D" }, away: { kind: "fixed", rank: 3, group: "B" },
    kickoffUtc: "2026-07-02T00:00:00Z", venue: "Levi's Stadium", city: "Santa Clara", country: "USA" },
  // Match 82 — Jul 01 20:00 UTC  (Belgium vs 3rd A/I/J)
  { home: { kind: "fixed", rank: 1, group: "G" }, away: { kind: "best3rd", groups: ["A", "I", "J"] },
    kickoffUtc: "2026-07-01T20:00:00Z", venue: "Lumen Field", city: "Seattle", country: "USA" },
  // Match 83 — Jul 02 23:00 UTC  (2nd K vs 2nd L)
  { home: { kind: "fixed", rank: 2, group: "K" }, away: { kind: "fixed", rank: 2, group: "L" },
    kickoffUtc: "2026-07-02T23:00:00Z", venue: "BMO Field", city: "Toronto", country: "Canada" },
  // Match 84 — Jul 02 19:00 UTC  (Spain vs 2nd J)
  { home: { kind: "fixed", rank: 1, group: "H" }, away: { kind: "fixed", rank: 2, group: "J" },
    kickoffUtc: "2026-07-02T19:00:00Z", venue: "SoFi Stadium", city: "Inglewood", country: "USA" },
  // Match 85 — Jul 03 03:00 UTC  (Switzerland vs 3rd G/J)
  { home: { kind: "fixed", rank: 1, group: "B" }, away: { kind: "best3rd", groups: ["G", "J"] },
    kickoffUtc: "2026-07-03T03:00:00Z", venue: "BC Place", city: "Vancouver", country: "Canada" },
  // Match 86 — Jul 03 22:00 UTC  (Argentina vs Cape Verde)
  { home: { kind: "fixed", rank: 1, group: "J" }, away: { kind: "fixed", rank: 2, group: "H" },
    kickoffUtc: "2026-07-03T22:00:00Z", venue: "Hard Rock Stadium", city: "Miami Gardens", country: "USA" },
  // Match 87 — Jul 04 01:30 UTC  (Winner K vs 3rd E/I/L)
  { home: { kind: "fixed", rank: 1, group: "K" }, away: { kind: "best3rd", groups: ["E", "I", "L"] },
    kickoffUtc: "2026-07-04T01:30:00Z", venue: "Arrowhead Stadium", city: "Kansas City", country: "USA" },
  // Match 88 — Jul 03 18:00 UTC  (Australia vs Egypt)
  { home: { kind: "fixed", rank: 2, group: "D" }, away: { kind: "fixed", rank: 2, group: "G" },
    kickoffUtc: "2026-07-03T18:00:00Z", venue: "AT&T Stadium", city: "Arlington", country: "USA" },
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
  return `3rd Group ${spec.groups.join("/")}`;
}

function resolveFixed(spec: SpecFixed, byGroupRank: Map<string, TeamInfo>): TeamInfo | null {
  return byGroupRank.get(`${spec.group}-${spec.rank}`) ?? null;
}

// A team is mathematically guaranteed rank R if:
//   (a) no other team can EXCEED their current pts (strictly), and
//   (b) no other team with remaining games can TIE their current pts
//       (a tie would require GD/GF tie-breaking which isn't yet deterministic).
function isRankGuaranteedByPoints(
  targetRank: number,
  teamPts: number,
  otherTeams: { pts: number; remaining: number }[]
): boolean {
  let canBeat = 0;
  let canFutureTie = 0;
  for (const o of otherTeams) {
    const maxPts = o.pts + 3 * o.remaining;
    if (maxPts > teamPts) canBeat++;
    else if (maxPts === teamPts && o.remaining > 0) canFutureTie++;
  }
  return canBeat < targetRank && canFutureTie === 0;
}

// Bipartite matching (augmenting-path DFS) to assign best3rd teams to slots.
// Returns a map of formula index → TeamInfo.
// Requires ALL pool groups across all 5 slots to be fully finished before assigning
// anything, so the global third-place ranking is accurate.
function computeBest3rdAssignments(
  thirdsByGroup: Map<string, TeamInfo>,
  fullyFinishedGroups: Set<string>
): Map<number, TeamInfo> {
  // Collect all groups referenced in any best3rd pool
  const allPoolGroups = new Set<string>();
  for (const f of R32_FORMULAS) {
    if (f.away.kind === "best3rd") f.away.groups.forEach(g => allPoolGroups.add(g));
    if (f.home.kind === "best3rd") f.home.groups.forEach(g => allPoolGroups.add(g));
  }

  // All pool groups must be fully finished before we can do global ranking
  for (const g of allPoolGroups) {
    if (!fullyFinishedGroups.has(g)) return new Map();
  }

  // Find the top 5 dynamic qualifying groups (exclude B, D, F which are fixed slots)
  const FIXED_GROUPS = new Set(["B", "D", "F"]);
  const dynamicQualifiers = new Set(
    [...thirdsByGroup.values()]
      .filter(t => !FIXED_GROUPS.has(t.group))
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
      .slice(0, 5)
      .map(t => t.group)
  );

  // Build slot candidate lists: formula index → qualifying groups in pool
  const slotCandidates = new Map<number, string[]>();
  for (let i = 0; i < R32_FORMULAS.length; i++) {
    const spec = R32_FORMULAS[i].away.kind === "best3rd" ? R32_FORMULAS[i].away as SpecBest3rd
               : R32_FORMULAS[i].home.kind === "best3rd" ? R32_FORMULAS[i].home as SpecBest3rd
               : null;
    if (!spec) continue;
    const candidates = spec.groups.filter(g => dynamicQualifiers.has(g));
    if (candidates.length > 0) slotCandidates.set(i, candidates);
  }

  // Augmenting-path bipartite matching: group → formula index
  const groupAssignment = new Map<string, number>();

  function dfs(formulaIdx: number, visited: Set<string>): boolean {
    for (const group of slotCandidates.get(formulaIdx) ?? []) {
      if (visited.has(group)) continue;
      visited.add(group);
      const current = groupAssignment.get(group);
      if (current === undefined || dfs(current, visited)) {
        groupAssignment.set(group, formulaIdx);
        return true;
      }
    }
    return false;
  }

  for (const idx of slotCandidates.keys()) {
    dfs(idx, new Set());
  }

  // Invert to formula index → team
  const result = new Map<number, TeamInfo>();
  for (const [group, idx] of groupAssignment) {
    const team = thirdsByGroup.get(group);
    if (team) result.set(idx, team);
  }
  return result;
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.email || session.user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allTeams = await prisma.team.findMany({
    select: { id: true, code: true, name: true, group: true },
  });

  const allGroupMatches = await prisma.match.findMany({
    where: { stage: "GROUP" },
    select: { group: true, status: true, teamAId: true, teamBId: true, scoreA: true, scoreB: true },
  });

  // Determine fully finished groups (all 6 matches FINISHED)
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

  // Stats from ALL finished matches — used for within-group rank-1/2/3 assignments.
  const statsMap = new Map<string, { pts: number; gd: number; gf: number }>();
  for (const t of allTeams) statsMap.set(t.id, { pts: 0, gd: 0, gf: 0 });

  for (const m of allGroupMatches) {
    if (!m.group || m.status !== "FINISHED") continue;
    if (!m.teamAId || !m.teamBId || m.scoreA === null || m.scoreB === null) continue;
    const a = statsMap.get(m.teamAId)!;
    const b = statsMap.get(m.teamBId)!;
    if (m.scoreA > m.scoreB) { a.pts += 3; }
    else if (m.scoreA < m.scoreB) { b.pts += 3; }
    else { a.pts += 1; b.pts += 1; }
    a.gd += m.scoreA - m.scoreB; a.gf += m.scoreA;
    b.gd += m.scoreB - m.scoreA; b.gf += m.scoreB;
  }

  // Count remaining (non-FINISHED) group matches per team for guarantee checks
  const remainingByTeam = new Map<string, number>();
  for (const m of allGroupMatches) {
    if (m.status === "FINISHED") continue;
    if (m.teamAId) remainingByTeam.set(m.teamAId, (remainingByTeam.get(m.teamAId) ?? 0) + 1);
    if (m.teamBId) remainingByTeam.set(m.teamBId, (remainingByTeam.get(m.teamBId) ?? 0) + 1);
  }

  const teamsByGroup = new Map<string, typeof allTeams>();
  for (const t of allTeams) {
    if (!t.group) continue;
    if (!teamsByGroup.has(t.group)) teamsByGroup.set(t.group, []);
    teamsByGroup.get(t.group)!.push(t);
  }

  // byGroupRank: a slot is filled only when the team's rank is mathematically guaranteed.
  // thirdsByGroup: still requires the full group to be finished (cross-group ranking needs final stats).
  const byGroupRank = new Map<string, TeamInfo>();
  const thirdsByGroup = new Map<string, TeamInfo>();

  for (const [group, teams] of teamsByGroup) {
    const isFullyDone = fullyFinishedGroups.has(group);
    const ranked = teams
      .map(t => ({ ...t, ...statsMap.get(t.id) ?? { pts: 0, gd: 0, gf: 0 }, group }))
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

    ranked.forEach((t, i) => {
      const rank = i + 1;
      const info: TeamInfo = { ...t, rank };
      const guaranteed = isFullyDone || isRankGuaranteedByPoints(
        rank,
        t.pts,
        ranked.filter(o => o.id !== t.id).map(o => ({
          pts: o.pts,
          remaining: remainingByTeam.get(o.id) ?? 0,
        }))
      );
      if (guaranteed) byGroupRank.set(`${group}-${rank}`, info);
      if (isFullyDone && rank === 3) thirdsByGroup.set(group, info);
    });
  }

  // Precompute best3rd slot assignments via bipartite matching
  const best3rdAssignments = computeBest3rdAssignments(thirdsByGroup, fullyFinishedGroups);

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

  // FD team-pair lookup — optional override for kickoff/venue when FD has confirmed teams
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  const fdByTeamPair = new Map<string, { utcDate: string; venue: string | null }>();
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
    } catch { /* non-fatal */ }
  }

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

    const homeSpec = formula.home;
    const awaySpec = formula.away;
    const homeTeam = homeSpec.kind === "fixed" ? resolveFixed(homeSpec, byGroupRank)
                   : (best3rdAssignments.get(i) ?? null);
    const awayTeam = awaySpec.kind === "fixed" ? resolveFixed(awaySpec, byGroupRank)
                   : (best3rdAssignments.get(i) ?? null);

    const homeLabel = specLabel(homeSpec, homeTeam);
    const awayLabel = specLabel(awaySpec, awayTeam);

    const fdEntry = homeTeam && awayTeam
      ? (fdByTeamPair.get(`${homeTeam.code}-${awayTeam.code}`) ??
         fdByTeamPair.get(`${awayTeam.code}-${homeTeam.code}`))
      : undefined;

    await prisma.match.update({
      where: { id: slot.id },
      data: {
        // Only write teamIds when we have a confirmed team — never null-out a slot
        // that was previously populated but whose group isn't fully settled yet.
        ...(homeTeam !== null ? { teamAId: homeTeam.id } : {}),
        ...(awayTeam !== null ? { teamBId: awayTeam.id } : {}),
        teamALabel: homeLabel,
        teamBLabel: awayLabel,
        kickoff: fdEntry ? new Date(fdEntry.utcDate) : new Date(formula.kickoffUtc),
        venue: fdEntry?.venue ?? formula.venue,
        city: formula.city,
        country: formula.country,
      },
    });

    kickoffsFixed++;
    if (homeTeam && awayTeam) assigned++;
    details.push(`#${slot.matchNumber}: ${homeLabel} vs ${awayLabel}`);
  }

  const incompleteGroups = [...groupMatchCount.keys()]
    .filter(g => !fullyFinishedGroups.has(g))
    .sort();

  const thirdPlaceRanking = [...thirdsByGroup.values()]
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
    .map((t, i) => ({ rank: i + 1, group: t.group, name: t.name, pts: t.pts, gd: t.gd, gf: t.gf }));

  return NextResponse.json({ assigned, kickoffsFixed, skipped, details, incompleteGroups, thirdPlaceRanking });
}
