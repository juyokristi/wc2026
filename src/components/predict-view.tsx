"use client";

import { useState } from "react";
import { MatchCard } from "@/components/match-card";

interface SerializedMatch {
  id: string;
  matchNumber: number;
  stage: string;
  group: string | null;
  teamAId: string | null;
  teamBId: string | null;
  teamALabel: string | null;
  teamBLabel: string | null;
  teamA: { name: string; flagEmoji: string; code: string } | null;
  teamB: { name: string; flagEmoji: string; code: string } | null;
  kickoff: string;
  venue: string;
  city: string;
  country: string;
  scoreA: number | null;
  scoreB: number | null;
  scoreAFull: number | null;
  scoreBFull: number | null;
  overtime: string | null;
  winnerId: string | null;
  status: string;
}

interface Prediction {
  predictedA: number;
  predictedB: number;
  pointsEarned: number | null;
  qualifierPick: string | null;
}

interface PredictViewProps {
  byGroup: Record<string, SerializedMatch[]>;
  byKnockoutStage: Record<string, SerializedMatch[]>;
  predictionMap: Record<string, Prediction>;
  stageOrder: string[];
  STAGE_LABELS: Record<string, string>;
}

function groupByDay(matches: SerializedMatch[]) {
  const byDay: Record<string, SerializedMatch[]> = {};
  for (const m of matches) {
    const key = new Date(m.kickoff).toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(m);
  }
  return byDay;
}

export function PredictView({
  byGroup,
  byKnockoutStage,
  predictionMap,
  stageOrder,
  STAGE_LABELS,
}: PredictViewProps) {
  const [view, setView] = useState<"group" | "day" | "open">("day");
  const [showPast, setShowPast] = useState(false);

  const allMatches: SerializedMatch[] = [
    ...Object.values(byGroup).flat(),
    ...Object.values(byKnockoutStage).flat(),
  ].sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());

  const byDay = groupByDay(allMatches);

  const openMatches = allMatches.filter(
    (m) => m.status === "SCHEDULED" && new Date(m.kickoff) > new Date() && !predictionMap[m.id]
  );
  const openByDay = groupByDay(openMatches);

  const LABELS: Record<string, string> = { group: "By group", day: "By day", open: "Open" };

  return (
    <div className="space-y-10">
      {/* Toggle */}
      <div className="flex gap-2">
        {(["group", "day", "open"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
            style={{
              backgroundColor: view === v ? "rgba(150,133,228,0.15)" : "transparent",
              color: view === v ? "#9685E4" : "var(--muted-foreground)",
              border: `1px solid ${view === v ? "rgba(150,133,228,0.3)" : "var(--border)"}`,
            }}
          >
            {LABELS[v]}
            {v === "open" && openMatches.length > 0 && (
              <span className="ml-1.5 font-bold" style={{ color: view === v ? "#9685E4" : "var(--muted-foreground)" }}>
                {openMatches.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {view === "group" ? (
        <>
          {/* Group Stage */}
          <section>
            <h2 className="text-lg font-semibold mb-5" style={{ color: "var(--foreground)" }}>
              Group Stage
            </h2>
            <div className="space-y-8">
              {Object.keys(byGroup)
                .sort()
                .map((group) => (
                  <div key={group}>
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="text-xs font-bold uppercase tracking-[1.5px] px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: "rgba(150,133,228,0.1)", color: "#9685E4" }}
                      >
                        Group {group}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {byGroup[group].map((m) => (
                        <MatchCard
                          key={m.id}
                          match={m}
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
                <h2
                  className="text-lg font-semibold mb-4"
                  style={{ color: "var(--foreground)" }}
                >
                  {STAGE_LABELS[stage]}
                </h2>
                <div className="space-y-2">
                  {stageMatches.map((m) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      prediction={predictionMap[m.id] ?? null}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      ) : view === "day" ? (
        <>
          {(() => {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const allDays = Object.keys(byDay);
            const pastDays = allDays.filter(
              (day) => new Date(byDay[day][0].kickoff) < todayStart
            );
            const visibleDays = showPast
              ? allDays
              : allDays.filter((day) => new Date(byDay[day][0].kickoff) >= todayStart);
            return (
              <>
                {pastDays.length > 0 && (
                  <button
                    className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                    style={{
                      border: "1px solid var(--border)",
                      color: "var(--muted-foreground)",
                    }}
                    onClick={() => setShowPast((v) => !v)}
                  >
                    {showPast ? "Hide past" : `Show past (${pastDays.length} day${pastDays.length !== 1 ? "s" : ""})`}
                  </button>
                )}
                {visibleDays.map((day) => (
                  <section key={day}>
                    <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
                      {day}
                    </h2>
                    <div className="space-y-2">
                      {byDay[day].map((m) => (
                        <MatchCard key={m.id} match={m} prediction={predictionMap[m.id] ?? null} />
                      ))}
                    </div>
                  </section>
                ))}
              </>
            );
          })()}
        </>
      ) : (
        <>
          {openMatches.length === 0 ? (
            <div
              className="rounded-2xl py-14 text-center"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
            >
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                All caught up
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
                You've predicted every open match. Check back before the next kickoff.
              </p>
            </div>
          ) : (
            Object.keys(openByDay).map((day) => (
              <section key={day}>
                <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
                  {day}
                </h2>
                <div className="space-y-2">
                  {openByDay[day].map((m) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      prediction={predictionMap[m.id] ?? null}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}
