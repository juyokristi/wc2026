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
  const [open, setOpen] = useState(false);

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
        setOpen(false);
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
            <span className="text-2xl">{pick.team.flagEmoji}</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
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
                  className="text-xl font-bold"
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
                <p className="text-xl font-bold" style={{ color: "#9685E4", letterSpacing: "-0.5px" }}>
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
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
    >
      {/* Header row — always visible, toggles open */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[2px]" style={{ color: "#9685E4" }}>
            Tournament Winner Pick
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Worth up to{" "}
            <span className="font-semibold" style={{ color: "#9685E4" }}>
              {potentialPoints} pts
            </span>{" "}
            today · one-time lock
          </p>
        </div>
        <span
          className="text-lg shrink-0 transition-transform"
          style={{
            color: "var(--muted-foreground)",
            display: "inline-block",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ›
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          {/* How it works */}
          <div
            className="rounded-xl px-4 py-3 text-xs space-y-1"
            style={{ backgroundColor: "rgba(150,133,228,0.07)", border: "1px solid rgba(150,133,228,0.15)" }}
          >
            <p className="font-semibold" style={{ color: "#9685E4" }}>How points are calculated</p>
            <p style={{ color: "var(--muted-foreground)" }}>
              Points = number of days remaining until the Final (Jul 19). Pick early → more points.
              Today a correct pick is worth <span className="font-semibold" style={{ color: "var(--foreground)" }}>{potentialPoints} pts</span>.
              Wrong pick scores 0. <span className="font-semibold" style={{ color: "var(--foreground)" }}>Cannot be changed once locked.</span>
            </p>
          </div>

          {/* Confirm bar */}
          {selected && (
            <div
              className="rounded-xl px-4 py-3 flex items-center justify-between gap-4"
              style={{ backgroundColor: "rgba(150,133,228,0.08)", border: "1px solid rgba(150,133,228,0.2)" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{selected.flagEmoji}</span>
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
                  className="text-xs px-3 py-1.5 rounded-lg font-medium"
                  style={{ color: "var(--muted-foreground)", backgroundColor: "var(--muted)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={lockIn}
                  disabled={loading}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                  style={{ backgroundColor: "#9685E4", color: "#fff", opacity: loading ? 0.6 : 1 }}
                >
                  {loading ? "Locking…" : "Lock in"}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs" style={{ color: "#FE7637" }}>{error}</p>
          )}

          {/* Team grid */}
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1.5">
            {teams.map((team) => (
              <button
                key={team.id}
                onClick={() => setSelected(team)}
                className="flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg text-center transition-colors"
                style={{
                  border: selected?.id === team.id
                    ? "1px solid #9685E4"
                    : "1px solid var(--border)",
                  backgroundColor: selected?.id === team.id
                    ? "rgba(150,133,228,0.1)"
                    : "transparent",
                }}
              >
                <span className="text-base leading-none">{team.flagEmoji}</span>
                <span className="text-[9px] font-semibold" style={{ color: "var(--muted-foreground)" }}>
                  {team.code}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
