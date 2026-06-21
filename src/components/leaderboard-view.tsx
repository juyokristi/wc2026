"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";

export interface UserStats {
  userId: string;
  name: string;
  image: string | null;
  totalPts: number;
  scoredCount: number;
  avgPts: number;
  bestDayPts: number;
  last5Avg: number;
  exactCount: number;
  exactPct: number;
  groupPts: number;
  knockoutPts: number;
  winnerPick?: {
    teamName: string;
    flag: string;
    potentialPts: number;
    pointsEarned: number | null;
  };
}

type TabKey = "total" | "avg" | "bestDay" | "last5" | "exact" | "group" | "knockout";

const TABS: { key: TabKey; label: string }[] = [
  { key: "total", label: "Total" },
  { key: "avg", label: "Avg/pred" },
  { key: "bestDay", label: "Best day" },
  { key: "last5", label: "Last 5" },
  { key: "exact", label: "Exact %" },
  { key: "group", label: "Group" },
  { key: "knockout", label: "Knockout" },
];

function getTabValue(s: UserStats, tab: TabKey): number {
  switch (tab) {
    case "total": return s.totalPts;
    case "avg": return s.avgPts;
    case "bestDay": return s.bestDayPts;
    case "last5": return s.last5Avg;
    case "exact": return s.exactPct;
    case "group": return s.groupPts;
    case "knockout": return s.knockoutPts;
  }
}

function formatTabValue(s: UserStats, tab: TabKey): string {
  switch (tab) {
    case "total": return `${s.totalPts}`;
    case "avg": return s.avgPts.toFixed(2);
    case "bestDay": return `${s.bestDayPts}`;
    case "last5": return s.last5Avg.toFixed(2);
    case "exact": return `${s.exactPct.toFixed(0)}%`;
    case "group": return `${s.groupPts}`;
    case "knockout": return `${s.knockoutPts}`;
  }
}

function getSubLabel(s: UserStats, tab: TabKey): string {
  switch (tab) {
    case "total": return `${s.scoredCount} scored`;
    case "avg": return `${s.scoredCount} predictions`;
    case "bestDay": return "single day";
    case "last5": return "last 5 matches";
    case "exact": return `${s.exactCount} exact`;
    case "group": return "group stage";
    case "knockout": return "knockout";
  }
}

function rankDisplay(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return String(rank);
}

interface Props {
  stats: UserStats[];
  currentUserId: string | null;
}

export function LeaderboardView({ stats, currentUserId }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("total");

  const sorted = [...stats].sort((a, b) => getTabValue(b, activeTab) - getTabValue(a, activeTab));

  return (
    <div className="space-y-4">
      {/* Tab strip */}
      <div className="flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
            style={{
              backgroundColor: activeTab === tab.key ? "#9685E4" : "var(--muted)",
              color: activeTab === tab.key ? "#fff" : "var(--muted-foreground)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
      >
        {sorted.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              No scores yet. Check back after matches are played.
            </p>
          </div>
        ) : (
          sorted.map((entry, i) => {
            const isMe = entry.userId === currentUserId;
            const rank = i + 1;
            const medal = rankDisplay(rank);
            const isMedal = rank <= 3;
            const displayValue = formatTabValue(entry, activeTab);
            const subLabel = getSubLabel(entry, activeTab);

            const rowStyle = {
              borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none",
              backgroundColor: isMe ? "rgba(150, 133, 228, 0.06)" : "transparent",
            };

            const rowInner = (
              <>
                <div className="w-8 shrink-0 text-center">
                  {isMedal ? (
                    <span className="text-lg">{medal}</span>
                  ) : (
                    <span className="text-sm font-semibold" style={{ color: "var(--muted-foreground)" }}>
                      {medal}
                    </span>
                  )}
                </div>

                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={entry.image ?? undefined} alt={entry.name} />
                  <AvatarFallback
                    className="text-xs font-medium"
                    style={{ backgroundColor: "var(--muted)", color: "var(--mid-foreground)" }}
                  >
                    {entry.name[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                    {entry.name}
                    {isMe && (
                      <span className="ml-2 text-xs font-semibold" style={{ color: "#9685E4" }}>
                        you
                      </span>
                    )}
                  </p>
                  {entry.winnerPick && (
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {entry.winnerPick.flag} {entry.winnerPick.teamName}
                      {entry.winnerPick.pointsEarned !== null
                        ? ` · ${entry.winnerPick.pointsEarned > 0 ? "✓" : "✗"} ${entry.winnerPick.pointsEarned} pts`
                        : ` · ${entry.winnerPick.potentialPts} pts potential`}
                    </p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <p
                    className="text-base font-bold tabular-nums"
                    style={{ color: isMe ? "#9685E4" : "var(--foreground)" }}
                  >
                    {displayValue}
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {subLabel}
                  </p>
                </div>
              </>
            );

            if (!isMe && entry.userId) {
              return (
                <Link
                  key={entry.userId}
                  href={`/players/${entry.userId}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors"
                  style={rowStyle}
                >
                  {rowInner}
                </Link>
              );
            }

            return (
              <div
                id="me-row"
                key={entry.userId}
                className="flex items-center gap-4 px-5 py-4"
                style={rowStyle}
              >
                {rowInner}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
