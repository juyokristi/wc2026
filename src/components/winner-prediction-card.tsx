"use client";

import { useState } from "react";

interface Team {
  id: string;
  name: string;
  code: string;
  flagEmoji: string;
}

interface WinnerPick {
  id: string;
  teamId: string;
  potentialPoints: number;
  pointsEarned: number | null;
  lockedAt: string;
  team: { name: string; flagEmoji: string; code: string };
}

interface Props {
  teams: Team[];
  initialPick: WinnerPick | null;
  potentialPoints: number;
}

export function WinnerPredictionCard({ teams, initialPick, potentialPoints }: Props) {
  const [pick, setPick] = useState<WinnerPick | null>(initialPick);
  const [selected, setSelected] = useState<Team | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lockIn() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/predictions/winner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: selected.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        setPick(data.pick);
        setSelected(null);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (pick) {
    const lockedDate = new Date(pick.lockedAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    return (
      <div
        className="rounded-2xl p-5"
        style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
      >
        <p className="text-xs font-bold uppercase tracking-[2px] mb-3" style={{ color: "#9685E4" }}>
          Tournament Winner Pick
        </p>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{pick.team.flagEmoji}</span>
            <div>
              <p className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
                {pick.team.name}
              </p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Locked {lockedDate}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            {pick.pointsEarned !== null ? (
              <div>
                <p
                  className="text-2xl font-bold"
                  style={{ color: pick.pointsEarned > 0 ? "#32BEBF" : "var(--muted-foreground)", letterSpacing: "-0.5px" }}
                >
                  {pick.pointsEarned} pts
                </p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {pick.pointsEarned > 0 ? "Correct!" : "Incorrect"}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-2xl font-bold" style={{ color: "#9685E4", letterSpacing: "-0.5px" }}>
                  {pick.potentialPoints} pts
                </p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  Potential · Final pending
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[2px] mb-1" style={{ color: "#9685E4" }}>
          Tournament Winner Pick
        </p>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Pick the tournament winner and earn{" "}
          <span className="font-semibold" style={{ color: "#9685E4" }}>
            {potentialPoints} pts
          </span>{" "}
          if correct. This cannot be changed once locked.
        </p>
      </div>

      {selected ? (
        <div
          className="rounded-xl p-4 flex items-center justify-between gap-4"
          style={{ backgroundColor: "rgba(150,133,228,0.08)", border: "1px solid rgba(150,133,228,0.2)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-2xl">{selected.flagEmoji}</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                {selected.name}
              </p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Lock in for {potentialPoints} pts?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setSelected(null)}
              className="text-sm px-3 py-1.5 rounded-lg font-medium"
              style={{ color: "var(--muted-foreground)", backgroundColor: "var(--muted)" }}
            >
              Cancel
            </button>
            <button
              onClick={lockIn}
              disabled={loading}
              className="text-sm px-3 py-1.5 rounded-lg font-semibold"
              style={{ backgroundColor: "#9685E4", color: "#fff", opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Locking…" : "Lock in"}
            </button>
          </div>
        </div>
      ) : null}

      {error && (
        <p className="text-sm" style={{ color: "#FE7637" }}>{error}</p>
      )}

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {teams.map((team) => (
          <button
            key={team.id}
            onClick={() => setSelected(team)}
            className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-center transition-colors"
            style={{
              border: selected?.id === team.id
                ? "1px solid #9685E4"
                : "1px solid var(--border)",
              backgroundColor: selected?.id === team.id
                ? "rgba(150,133,228,0.1)"
                : "transparent",
            }}
          >
            <span className="text-xl leading-none">{team.flagEmoji}</span>
            <span className="text-[10px] font-semibold" style={{ color: "var(--muted-foreground)" }}>
              {team.code}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
