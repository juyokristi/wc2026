import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MatchCard } from "@/components/match-card";
import { Badge } from "@/components/ui/badge";
import { MatchStage } from "@/generated/prisma/client";

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

  const [matches, userPredictions] = await Promise.all([
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Predictions</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Enter scores before kickoff. Predictions lock automatically when each match starts.
        </p>
      </div>

      {/* Group Stage */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Group Stage</h2>
        <div className="space-y-8">
          {Object.keys(byGroup).sort().map((group) => (
            <div key={group}>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline">Group {group}</Badge>
              </div>
              <div className="space-y-2">
                {byGroup[group].map((m) => (
                  <MatchCard
                    key={m.id}
                    match={serializeMatch(m)}
                    prediction={predictionMap[m.id] ?? null}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Knockout Stages */}
      {stageOrder.map((stage) => {
        const stageMatches = byKnockoutStage[stage];
        if (!stageMatches?.length) return null;
        return (
          <section key={stage}>
            <h2 className="text-lg font-semibold mb-4">{STAGE_LABELS[stage]}</h2>
            <div className="space-y-2">
              {stageMatches.map((m) => (
                <MatchCard
                  key={m.id}
                  match={serializeMatch(m)}
                  prediction={predictionMap[m.id] ?? null}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
