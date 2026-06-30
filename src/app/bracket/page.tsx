import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BracketView } from "@/components/bracket-view";

export const revalidate = 60;

export default async function BracketPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const [knockoutMatches, userPredictions] = await Promise.all([
    prisma.match.findMany({
      where: { stage: { not: "GROUP" } },
      include: {
        teamA: { select: { name: true, flagEmoji: true, code: true } },
        teamB: { select: { name: true, flagEmoji: true, code: true } },
      },
      orderBy: [{ kickoff: "asc" }, { matchNumber: "asc" }],
    }),
    prisma.prediction.findMany({
      where: {
        userId: session.user.id,
        match: { stage: { not: "GROUP" } },
      },
      select: { matchId: true, predictedA: true, predictedB: true, pointsEarned: true },
    }),
  ]);

  const predMap = Object.fromEntries(userPredictions.map((p) => [p.matchId, p]));

  return (
    <div className="px-4 py-10 space-y-6">
      <div className="max-w-7xl mx-auto">
        <p className="text-xs font-bold uppercase tracking-[2px] mb-2" style={{ color: "#9685E4" }}>WC2026</p>
        <h1 className="text-3xl font-bold" style={{ letterSpacing: "-0.5px", color: "var(--foreground)" }}>
          Bracket
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          Knockout stages — your predictions shown below each match.
        </p>
      </div>

      <BracketView matches={knockoutMatches} predMap={predMap} />
    </div>
  );
}
