import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MatchStage } from "@/generated/prisma/client";
import { PredictView } from "@/components/predict-view";
import Link from "next/link";

export const revalidate = 300;

const STAGE_LABELS: Record<string, string> = {
  GROUP: "Group Stage",
  ROUND_OF_32: "Round of 32",
  ROUND_OF_16: "Round of 16",
  QUARTER_FINAL: "Quarter-Finals",
  SEMI_FINAL: "Semi-Finals",
  THIRD_PLACE: "Third Place",
  FINAL: "Final",
};

export default async function PredictPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const [matches, userPredictions, dbUser] = await Promise.all([
    prisma.match.findMany({
      include: {
        teamA: { select: { name: true, flagEmoji: true, code: true } },
        teamB: { select: { name: true, flagEmoji: true, code: true } },
      },
      orderBy: [{ kickoff: "asc" }, { matchNumber: "asc" }],
    }),
    prisma.prediction.findMany({
      where: { userId: session.user.id },
      select: { matchId: true, predictedA: true, predictedB: true, pointsEarned: true },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, displayName: true },
    }),
  ]);

  const predictionMap = Object.fromEntries(
    userPredictions.map((p) => [p.matchId, p])
  );

  // Group by stage then by group letter
  const groupStageMatches = matches.filter((m) => m.stage === MatchStage.GROUP);
  const knockoutMatches = matches.filter((m) => m.stage !== MatchStage.GROUP);

  const byGroup: Record<string, typeof groupStageMatches> = {};
  for (const m of groupStageMatches) {
    const g = m.group ?? "?";
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(m);
  }

  const byKnockoutStage: Record<string, typeof knockoutMatches> = {};
  for (const m of knockoutMatches) {
    if (!byKnockoutStage[m.stage]) byKnockoutStage[m.stage] = [];
    byKnockoutStage[m.stage].push(m);
  }

  const stageOrder = ["ROUND_OF_32", "ROUND_OF_16", "QUARTER_FINAL", "SEMI_FINAL", "THIRD_PLACE", "FINAL"];

  function serializeMatch(m: (typeof matches)[0]) {
    return {
      ...m,
      kickoff: m.kickoff.toISOString(),
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }

  const serializedByGroup = Object.fromEntries(
    Object.entries(byGroup).map(([k, v]) => [k, v.map(serializeMatch)])
  );
  const serializedByKnockoutStage = Object.fromEntries(
    Object.entries(byKnockoutStage).map(([k, v]) => [k, v.map(serializeMatch)])
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-bold uppercase tracking-[2px] mb-2" style={{ color: "#9685E4" }}>
            WC2026
          </p>
          <h1 className="text-3xl font-bold" style={{ letterSpacing: "-0.5px", color: "var(--foreground)" }}>
            Predictions
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            Enter scores before kickoff. Predictions lock automatically when each match starts.
          </p>
        </div>
        <Link
          href="/predict/bulk"
          className="text-sm font-semibold shrink-0 mt-1"
          style={{ color: "#9685E4" }}
        >
          Quick predict →
        </Link>
      </div>

      {!dbUser?.displayName && (
        <div
          className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
          style={{
            backgroundColor: "rgba(150,133,228,0.1)",
            border: "1px solid rgba(150,133,228,0.25)",
          }}
        >
          <p className="text-sm" style={{ color: "#9685E4" }}>
            Set a display name so teammates can recognize you on the leaderboard.
          </p>
          <Link
            href="/profile"
            className="text-sm font-semibold shrink-0"
            style={{ color: "#9685E4" }}
          >
            Set name →
          </Link>
        </div>
      )}

      <PredictView
        byGroup={serializedByGroup}
        byKnockoutStage={serializedByKnockoutStage}
        predictionMap={predictionMap}
        stageOrder={stageOrder}
        STAGE_LABELS={STAGE_LABELS}
      />
    </div>
  );
}
