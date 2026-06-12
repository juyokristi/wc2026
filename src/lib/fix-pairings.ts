import { prisma } from "@/lib/prisma";

const FD_BASE = "https://api.football-data.org/v4";

interface FdMatchFull {
  utcDate: string;
  status: string;
  group?: string;
  stage?: string;
  homeTeam: { tla: string; name: string };
  awayTeam: { tla: string; name: string };
}

export interface FixPairingsResult {
  pairingsFixed: number;
  kickoffsUpdated: number;
  skipped: number;
  changes: string[];
}

export async function fixGroupPairings(): Promise<FixPairingsResult> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) throw new Error("FOOTBALL_DATA_API_KEY not set");

  const res = await fetch(`${FD_BASE}/competitions/WC/matches`, {
    headers: { "X-Auth-Token": apiKey },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`football-data.org error: ${res.status}`);

  const { matches: fdMatches } = (await res.json()) as { matches: FdMatchFull[] };

  // Only group stage matches that have a specific group letter
  const groupApiMatches = fdMatches.filter(
    (m) => m.group && (m.group.startsWith("GROUP_") || /^[A-L]$/.test(m.group))
  );

  const allTeams = await prisma.team.findMany({
    select: { id: true, code: true },
  });
  const teamByCode = new Map(allTeams.map((t) => [t.code.toUpperCase(), t]));

  const dbGroupMatches = await prisma.match.findMany({
    where: { stage: "GROUP" },
    include: {
      teamA: { select: { id: true, code: true } },
      teamB: { select: { id: true, code: true } },
    },
  });

  // Two-way team-pair lookup
  const byTeamPair = new Map<string, (typeof dbGroupMatches)[0]>();
  for (const m of dbGroupMatches) {
    if (m.teamA && m.teamB) {
      byTeamPair.set(`${m.teamA.code.toUpperCase()}-${m.teamB.code.toUpperCase()}`, m);
      byTeamPair.set(`${m.teamB.code.toUpperCase()}-${m.teamA.code.toUpperCase()}`, m);
    }
  }

  const matchedDbIds = new Set<string>();
  const changes: string[] = [];
  let pairingsFixed = 0;
  let kickoffsUpdated = 0;
  let skipped = 0;

  // Pass 1: match by team pair — mark these as correct and fix kickoffs
  for (const fd of groupApiMatches) {
    const homeTla = fd.homeTeam?.tla?.toUpperCase();
    const awayTla = fd.awayTeam?.tla?.toUpperCase();
    if (!homeTla || !awayTla) continue;

    const m = byTeamPair.get(`${homeTla}-${awayTla}`);
    if (!m || matchedDbIds.has(m.id)) continue;

    matchedDbIds.add(m.id);
    const correctKickoff = new Date(fd.utcDate);
    const kickoffDiff = Math.abs(m.kickoff.getTime() - correctKickoff.getTime());
    if (kickoffDiff > 60_000) {
      await prisma.match.update({
        where: { id: m.id },
        data: { kickoff: correctKickoff },
      });
      changes.push(`Kickoff fixed: ${homeTla} vs ${awayTla} → ${correctKickoff.toISOString().slice(0, 16)}`);
      kickoffsUpdated++;
    }
  }

  // Pass 2: for API matches not found by team pair, match by group + closest date
  for (const fd of groupApiMatches) {
    const homeTla = fd.homeTeam?.tla?.toUpperCase();
    const awayTla = fd.awayTeam?.tla?.toUpperCase();
    if (!homeTla || !awayTla) continue;

    const existingByPair = byTeamPair.get(`${homeTla}-${awayTla}`);
    if (existingByPair && matchedDbIds.has(existingByPair.id)) continue;

    const homeTeam = teamByCode.get(homeTla);
    const awayTeam = teamByCode.get(awayTla);
    if (!homeTeam || !awayTeam) {
      changes.push(`Skipped: TLA not in DB — ${homeTla} vs ${awayTla}`);
      skipped++;
      continue;
    }

    // Extract group letter: "GROUP_H" → "H", or just "H"
    const rawGroup = fd.group ?? "";
    const groupLetter = rawGroup.startsWith("GROUP_")
      ? rawGroup.slice(6)
      : rawGroup;

    // Find the DB match in same group, closest unmatched kickoff within 12h
    const apiDate = new Date(fd.utcDate);
    const candidates = dbGroupMatches.filter(
      (m) =>
        m.group === groupLetter &&
        !matchedDbIds.has(m.id) &&
        Math.abs(m.kickoff.getTime() - apiDate.getTime()) < 12 * 3600 * 1000
    );

    if (candidates.length === 0) {
      changes.push(`No candidate: ${homeTla} vs ${awayTla} (group ${groupLetter}, ${apiDate.toISOString().slice(0, 16)})`);
      skipped++;
      continue;
    }

    candidates.sort(
      (a, b) =>
        Math.abs(a.kickoff.getTime() - apiDate.getTime()) -
        Math.abs(b.kickoff.getTime() - apiDate.getTime())
    );
    const target = candidates[0];
    matchedDbIds.add(target.id);

    const oldA = target.teamA?.code ?? "?";
    const oldB = target.teamB?.code ?? "?";
    await prisma.match.update({
      where: { id: target.id },
      data: {
        teamAId: homeTeam.id,
        teamBId: awayTeam.id,
        kickoff: apiDate,
      },
    });
    changes.push(`Pairing fixed: #${target.matchNumber} ${oldA}+${oldB} → ${homeTla} vs ${awayTla} (${apiDate.toISOString().slice(0, 16)})`);
    pairingsFixed++;
  }

  return { pairingsFixed, kickoffsUpdated, skipped, changes };
}
