import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CircularBracket } from "@/components/circular-bracket";

const STAGE_ORDER = ["ROUND_OF_32", "ROUND_OF_16", "QUARTER_FINAL", "SEMI_FINAL", "FINAL"] as const;
const STAGE_LABELS: Record<string, string> = {
  ROUND_OF_32: "Round of 32",
  ROUND_OF_16: "Round of 16",
  QUARTER_FINAL: "QF",
  SEMI_FINAL: "SF",
  THIRD_PLACE: "3rd Place",
  FINAL: "Final",
};

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

  const thirdPlace = knockoutMatches.filter((m) => m.stage === "THIRD_PLACE");
  const byStage = STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    matches: knockoutMatches.filter((m) => m.stage === stage),
  })).filter((s) => s.matches.length > 0);

  return (
    <div className="px-4 py-10 space-y-8">
      <div className="max-w-7xl mx-auto">
        <p className="text-xs font-bold uppercase tracking-[2px] mb-2" style={{ color: "#9685E4" }}>WC2026</p>
        <h1 className="text-3xl font-bold" style={{ letterSpacing: "-0.5px", color: "var(--foreground)" }}>
          Bracket
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          Knockout stages — your predictions shown below each match.
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        <CircularBracket matches={knockoutMatches} />
      </div>

      <p className="text-xs text-center mt-2 mb-6" style={{ color: "var(--muted-foreground)" }}>
        Scroll down for match details
      </p>

      <div className="max-w-7xl mx-auto overflow-x-auto pb-4">
        <div className="flex gap-5 items-start" style={{ minWidth: "max-content" }}>
          {byStage.map(({ stage, label, matches }) => (
            <div key={stage} style={{ width: "200px" }}>
              <h3
                className="text-xs font-bold uppercase tracking-wider mb-3 px-1"
                style={{ color: "#9685E4" }}
              >
                {label}
                <span className="ml-1.5 font-normal" style={{ color: "var(--muted-foreground)" }}>
                  ({matches.length})
                </span>
              </h3>
              <div className="flex flex-col" style={{ gap: matches.length > 4 ? "6px" : matches.length > 2 ? "12px" : "24px" }}>
                {matches.map((m) => {
                  const teamA = m.teamA?.name ?? m.teamALabel ?? "TBD";
                  const teamB = m.teamB?.name ?? m.teamBLabel ?? "TBD";
                  const flagA = m.teamA?.flagEmoji ?? "🏳";
                  const flagB = m.teamB?.flagEmoji ?? "🏳";
                  const finished = m.status === "FINISHED";
                  const live = m.status === "LIVE";
                  const pred = predMap[m.id];

                  return (
                    <div
                      key={m.id}
                      className="rounded-xl overflow-hidden"
                      style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
                    >
                      {/* Team A row */}
                      <div
                        className="flex items-center justify-between px-3 py-2 gap-2"
                        style={{
                          borderBottom: "1px solid var(--border)",
                          backgroundColor: finished && m.scoreA !== null && m.scoreB !== null && m.scoreA > m.scoreB
                            ? "rgba(150,133,228,0.06)" : "transparent",
                        }}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm">{flagA}</span>
                          <span className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>{teamA}</span>
                        </div>
                        {(finished || live) && m.scoreA !== null && (
                          <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: "var(--foreground)" }}>
                            {m.scoreA}
                          </span>
                        )}
                      </div>
                      {/* Team B row */}
                      <div
                        className="flex items-center justify-between px-3 py-2 gap-2"
                        style={{
                          backgroundColor: finished && m.scoreA !== null && m.scoreB !== null && m.scoreB > m.scoreA
                            ? "rgba(150,133,228,0.06)" : "transparent",
                        }}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm">{flagB}</span>
                          <span className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>{teamB}</span>
                        </div>
                        {(finished || live) && m.scoreB !== null && (
                          <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: "var(--foreground)" }}>
                            {m.scoreB}
                          </span>
                        )}
                      </div>
                      {/* Prediction */}
                      {pred && (
                        <div
                          className="px-3 py-1 text-xs tabular-nums"
                          style={{ borderTop: "1px solid var(--border)", color: "var(--muted-foreground)" }}
                        >
                          You: {pred.predictedA}–{pred.predictedB}
                          {pred.pointsEarned !== null && (
                            <span className="ml-1.5 font-semibold" style={{ color: "#9685E4" }}>{pred.pointsEarned}pts</span>
                          )}
                        </div>
                      )}
                      {live && (
                        <div className="px-3 py-1 text-xs font-semibold animate-pulse" style={{ borderTop: "1px solid var(--border)", color: "#32BEBF" }}>
                          ● LIVE
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Third place as separate column */}
          {thirdPlace.length > 0 && (
            <div style={{ width: "200px" }}>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3 px-1" style={{ color: "#9685E4" }}>
                {STAGE_LABELS["THIRD_PLACE"]}
              </h3>
              <div>
                {thirdPlace.map((m) => {
                  const teamA = m.teamA?.name ?? m.teamALabel ?? "TBD";
                  const teamB = m.teamB?.name ?? m.teamBLabel ?? "TBD";
                  const flagA = m.teamA?.flagEmoji ?? "🏳";
                  const flagB = m.teamB?.flagEmoji ?? "🏳";
                  const finished = m.status === "FINISHED";
                  const live = m.status === "LIVE";
                  const pred = predMap[m.id];

                  return (
                    <div
                      key={m.id}
                      className="rounded-xl overflow-hidden"
                      style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
                    >
                      <div className="flex items-center justify-between px-3 py-2 gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm">{flagA}</span>
                          <span className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>{teamA}</span>
                        </div>
                        {(finished || live) && m.scoreA !== null && (
                          <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: "var(--foreground)" }}>{m.scoreA}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm">{flagB}</span>
                          <span className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>{teamB}</span>
                        </div>
                        {(finished || live) && m.scoreB !== null && (
                          <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: "var(--foreground)" }}>{m.scoreB}</span>
                        )}
                      </div>
                      {pred && (
                        <div className="px-3 py-1 text-xs tabular-nums" style={{ borderTop: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                          You: {pred.predictedA}–{pred.predictedB}
                          {pred.pointsEarned !== null && (
                            <span className="ml-1.5 font-semibold" style={{ color: "#9685E4" }}>{pred.pointsEarned}pts</span>
                          )}
                        </div>
                      )}
                      {live && (
                        <div className="px-3 py-1 text-xs font-semibold animate-pulse" style={{ borderTop: "1px solid var(--border)", color: "#32BEBF" }}>● LIVE</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
