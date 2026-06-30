"use client";

import { useState } from "react";
import { CircularBracket } from "@/components/circular-bracket";

export interface MatchTeam {
  name: string;
  flagEmoji: string;
  code: string;
}

export interface KnockoutMatch {
  id: string;
  matchNumber: number | null;
  stage: string;
  status: string;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  teamAId: string | null;
  teamBId: string | null;
  teamA: MatchTeam | null;
  teamB: MatchTeam | null;
  teamALabel: string | null;
  teamBLabel: string | null;
  kickoff: Date | string;
}

export interface MatchPred {
  predictedA: number;
  predictedB: number;
  pointsEarned: number | null;
}

interface BracketViewProps {
  matches: KnockoutMatch[];
  predMap: Record<string, MatchPred>;
}

const STAGE_ORDER = ["ROUND_OF_32", "ROUND_OF_16", "QUARTER_FINAL", "SEMI_FINAL", "FINAL"] as const;
const STAGE_LABELS: Record<string, string> = {
  ROUND_OF_32: "Round of 32",
  ROUND_OF_16: "Round of 16",
  QUARTER_FINAL: "QF",
  SEMI_FINAL: "SF",
  THIRD_PLACE: "3rd Place",
  FINAL: "Final",
};

function MatchCard({ m, pred }: { m: KnockoutMatch; pred: MatchPred | undefined }) {
  const teamA = m.teamA?.name ?? m.teamALabel ?? "TBD";
  const teamB = m.teamB?.name ?? m.teamBLabel ?? "TBD";
  const flagA = m.teamA?.flagEmoji ?? "🏳";
  const flagB = m.teamB?.flagEmoji ?? "🏳";
  const finished = m.status === "FINISHED";
  const live = m.status === "LIVE";

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 gap-2"
        style={{
          borderBottom: "1px solid var(--border)",
          backgroundColor:
            finished && m.scoreA !== null && m.scoreB !== null && m.scoreA > m.scoreB
              ? "rgba(150,133,228,0.06)"
              : "transparent",
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-base">{flagA}</span>
          <span className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>{teamA}</span>
        </div>
        {(finished || live) && m.scoreA !== null && (
          <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: "var(--foreground)" }}>
            {m.scoreA}
          </span>
        )}
      </div>
      <div
        className="flex items-center justify-between px-3 py-2 gap-2"
        style={{
          backgroundColor:
            finished && m.scoreA !== null && m.scoreB !== null && m.scoreB > m.scoreA
              ? "rgba(150,133,228,0.06)"
              : "transparent",
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-base">{flagB}</span>
          <span className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>{teamB}</span>
        </div>
        {(finished || live) && m.scoreB !== null && (
          <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: "var(--foreground)" }}>
            {m.scoreB}
          </span>
        )}
      </div>
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
        <div
          className="px-3 py-1 text-xs font-semibold animate-pulse"
          style={{ borderTop: "1px solid var(--border)", color: "#32BEBF" }}
        >
          ● LIVE
        </div>
      )}
    </div>
  );
}

export function BracketView({ matches, predMap }: BracketViewProps) {
  const [view, setView] = useState<"graph" | "bracket">("graph");

  const thirdPlace = matches.filter((m) => m.stage === "THIRD_PLACE");
  const byStage = STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    matches: matches.filter((m) => m.stage === stage),
  })).filter((s) => s.matches.length > 0);

  return (
    <div className="space-y-6">
      {/* Toggle */}
      <div className="flex justify-center">
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            display: "inline-flex",
          }}
        >
          {(["graph", "bracket"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: "6px 20px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                background: view === v ? "rgba(150,133,228,0.15)" : "transparent",
                color: view === v ? "#9685E4" : "var(--muted-foreground)",
                border: "none",
                cursor: "pointer",
                transition: "color 0.15s, background 0.15s",
                textTransform: "capitalize",
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Graph view */}
      {view === "graph" && (
        <div className="max-w-2xl mx-auto px-4">
          <CircularBracket matches={matches} />
        </div>
      )}

      {/* Bracket (column) view */}
      {view === "bracket" && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-5 items-start mx-auto" style={{ minWidth: "max-content", padding: "0 1rem" }}>
            {byStage.map(({ stage, label, matches: stageMatches }) => (
              <div key={stage} style={{ width: 200 }}>
                <h3
                  className="text-xs font-bold uppercase tracking-wider mb-3 px-1"
                  style={{ color: "#9685E4" }}
                >
                  {label}
                  <span className="ml-1.5 font-normal" style={{ color: "var(--muted-foreground)" }}>
                    ({stageMatches.length})
                  </span>
                </h3>
                <div
                  className="flex flex-col"
                  style={{
                    gap: stageMatches.length > 4 ? 6 : stageMatches.length > 2 ? 12 : 24,
                  }}
                >
                  {stageMatches.map((m) => (
                    <MatchCard key={m.id} m={m} pred={predMap[m.id]} />
                  ))}
                </div>
              </div>
            ))}

            {thirdPlace.length > 0 && (
              <div style={{ width: 200 }}>
                <h3
                  className="text-xs font-bold uppercase tracking-wider mb-3 px-1"
                  style={{ color: "#9685E4" }}
                >
                  {STAGE_LABELS["THIRD_PLACE"]}
                </h3>
                <div className="flex flex-col gap-6">
                  {thirdPlace.map((m) => (
                    <MatchCard key={m.id} m={m} pred={predMap[m.id]} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
