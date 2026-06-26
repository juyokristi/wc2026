import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (session?.user?.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all non-group, non-finished matches that have both teams assigned
  const knockoutAssigned = await prisma.match.findMany({
    where: {
      stage: { not: "GROUP" },
      status: { not: "FINISHED" },
      teamAId: { not: null },
      teamBId: { not: null },
    },
    include: {
      teamA: { select: { code: true, name: true } },
      teamB: { select: { code: true, name: true } },
    },
    orderBy: { matchNumber: "asc" },
  });

  // Group by canonical team pair key (sorted alphabetically so A-B == B-A)
  const byPair = new Map<string, typeof knockoutAssigned>();
  for (const m of knockoutAssigned) {
    const codes = [m.teamA!.code, m.teamB!.code].sort();
    const key = codes.join("-");
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key)!.push(m);
  }

  const cleared: { matchNumber: number; teams: string }[] = [];

  for (const [, matches] of byPair) {
    if (matches.length <= 1) continue;
    // Keep the first (lowest matchNumber), null out the rest
    const [, ...duplicates] = matches;
    for (const dup of duplicates) {
      await prisma.match.update({
        where: { id: dup.id },
        data: { teamAId: null, teamBId: null },
      });
      cleared.push({
        matchNumber: dup.matchNumber,
        teams: `${dup.teamA!.code} vs ${dup.teamB!.code}`,
      });
    }
  }

  return NextResponse.json({
    duplicatesCleared: cleared.length,
    cleared,
    message:
      cleared.length > 0
        ? "Duplicates cleared. Run Score Sync to repopulate."
        : "No duplicates found.",
  });
}
