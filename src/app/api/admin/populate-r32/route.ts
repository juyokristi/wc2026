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
// kickoffUtc: hardcoded from the confirmed schedule — always applied so the DB has
// correct times even when FD still shows TBD for unconfirmed slots.
// FD overrides the kickoff only when it returns a real (non-TBD) team pair match.
const R32_FORMULAS: Array<{ home: TeamSpec; away: TeamSpec; kickoffUtc: string; venue: string; city: string; country: string }> = [
  // Match 73 — Jun 28 19:00 UTC  (South Africa vs Canada, SoFi Stadium)
  { home: { kind: "fixed", rank: 2, group: "A" }, away: { kind: "fixed", rank: 2, group: "B" },
    kickoffUtc: "2026-06-28T19:00:00Z", venue: "SoFi Stadium", city: "Inglewood", country: "USA" },
  // Match 74 — Jun 29 20:30 UTC  (Germany vs Paraguay, Gillette Stadium)
  { home: { kind: "fixed", rank: 1, group: "E" }, away: { kind: "fixed", rank: 3, group: "D" },
    kickoffUtc: "2026-06-29T20:30:00Z", venue: "Gillette Stadium", city: "Foxborough", country: "USA" },
  // Match 75 — Jun 30 01:00 UTC  (Netherlands vs Morocco, Estadio BBVA)
  { home: { kind: "fixed", rank: 1, group: "F" }, away: { kind: "fixed", rank: 2, group: "C" },
    kickoffUtc: "2026-06-30T01:00:00Z", venue: "Estadio BBVA", city: "Guadalupe", country: "Mexico" },
  // Match 76 — Jun 29 17:00 UTC  (Brazil vs Japan, NRG Stadium)
  { home: { kind: "fixed", rank: 1, group: "C" }, away: { kind: "fixed", rank: 2, group: "F" },
    kickoffUtc: "2026-06-29T17:00:00Z", venue: "NRG Stadium", city: "Houston", country: "USA" },
  // Match 77 — Jun 30 21:00 UTC  (France vs Sweden, MetLife Stadium)
  { home: { kind: "fixed", rank: 1, group: "I" }, away: { kind: "fixed", rank: 3, group: "F" },
    kickoffUtc: "2026-06-30T21:00:00Z", venue: "MetLife Stadium", city: "East Rutherford", country: "USA" },
  // Match 78 — Jun 30 17:00 UTC  (Ivory Coast vs Norway, AT&T Stadium)
  { home: { kind: "fixed", rank: 2, group: "E" }, away: { kind: "fixed", rank: 2, group: "I" },
    kickoffUtc: "2026-06-30T17:00:00Z", venue: "AT&T Stadium", city: "Arlington", country: "USA" },
  // Match 79 — Jul 01 01:00 UTC  (Mexico vs best3rd C/E/H/I, Estadio Azteca)
  { home: { kind: "fixed", rank: 1, group: "A" }, away: { kind: "best3rd", groups: ["C", "E", "H", "I"] },
    kickoffUtc: "2026-07-01T01:00:00Z", venue: "Estadio Azteca", city: "Mexico City", country: "Mexico" },
  // Match 80 — Jul 01 16:00 UTC  (Winner L vs best3rd E/H/I/J/K, Mercedes-Benz Stadium)
  { home: { kind: "fixed", rank: 1, group: "L" }, away: { kind: "best3rd", groups: ["E", "H", "I", "J", "K"] },
    kickoffUtc: "2026-07-01T16:00:00Z", venue: "Mercedes-Benz Stadium", city: "Atlanta", country: "USA" },
  // Match 81 — Jul 02 00:00 UTC  (USA vs Bosnia, Levi's Stadium)
  { home: { kind: "fixed", rank: 1, group: "D" }, away: { kind: "fixed", rank: 3, group: "B" },
    kickoffUtc: "2026-07-02T00:00:00Z", venue: "Levi's Stadium", city: "Santa Clara", country: "USA" },
  // Match 82 — Jul 01 20:00 UTC  (Belgium vs best3rd A/E/H/I/J, Lumen Field)
  { home: { kind: "fixed", rank: 1, group: "G" }, away: { kind: "best3rd", groups: ["A", "E", "H", "I", "J"] },
    kickoffUtc: "2026-07-01T20:00:00Z", venue: "Lumen Field", city: "Seattle", country: "USA" },
  // Match 83 — Jul 02 23:00 UTC  (2nd K vs 2nd L, BMO Field)
  { home: { kind: "fixed", rank: 2, group: "K" }, away: { kind: "fixed", rank: 2, group: "L" },
    kickoffUtc: "2026-07-02T23:00:00Z", venue: "BMO Field", city: "Toronto", country: "Canada" },
  // Match 84 — Jul 02 19:00 UTC  (Spain vs 2nd J, SoFi Stadium)
  { home: { kind: "fixed", rank: 1, group: "H" }, away: { kind: "fixed", rank: 2, group: "J" },
    kickoffUtc: "2026-07-02T19:00:00Z", venue: "SoFi Stadium", city: "Inglewood", country: "USA" },
  // Match 85 — Jul 03 03:00 UTC  (Switzerland vs best3rd E/G/I/J, BC Place)
  { home: { kind: "fixed", rank: 1, group: "B" }, away: { kind: "best3rd", groups: ["E", "G", "I", "J"] },
    kickoffUtc: "2026-07-03T03:00:00Z", venue: "BC Place", city: "Vancouver", country: "Canada" },
  // Match 86 — Jul 03 22:00 UTC  (Argentina vs Cape Verde, Hard Rock Stadium)
  { home: { kind: "fixed", rank: 1, group: "J" }, away: { kind: "fixed", rank: 2, group: "H" },
    kickoffUtc: "2026-07-03T22:00:00Z", venue: "Hard Rock Stadium", city: "Miami Gardens", country: "USA" },
  // Match 87 — Jul 04 01:30 UTC  (Winner K vs best3rd E/I/J/L, Arrowhead Stadium)
  { home: { kind: "fixed", rank: 1, group: "K" }, away: { kind: "best3rd", groups: ["E", "I", "J", "L"] },
    kickoffUtc: "2026-07-04T01:30:00Z", venue: "Arrowhead Stadium", city: "Kansas City", country: "USA" },
  // Match 88 — Jul 03 18:00 UTC  (Australia vs Egypt, AT&T Stadium)
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

    // Always apply hardcoded kickoff/venue from the formula; FD overrides when it
    // has a confirmed (non-TBD) team-pair match.
    const fdEntry = homeTeam && awayTeam
      ? (fdByTeamPair.get(`${homeTeam.code}-${awayTeam.code}`) ??
         fdByTeamPair.get(`${awayTeam.code}-${homeTeam.code}`))
      : undefined;

    const updateData: {
      teamAId: string | null;
      teamBId: string | null;
      teamALabel: string;
      teamBLabel: string;
      kickoff: Date;
      venue: string;
      city: string;
      country: string;
    } = {
      teamAId: homeTeam?.id ?? null,
      teamBId: awayTeam?.id ?? null,
      teamALabel: homeLabel,
      teamBLabel: awayLabel,
      kickoff: fdEntry ? new Date(fdEntry.utcDate) : new Date(formula.kickoffUtc),
      venue: (fdEntry?.venue) ?? formula.venue,
      city: formula.city,
      country: formula.country,
    };

    kickoffsFixed++;

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
