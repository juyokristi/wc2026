"use client";

import { useState } from "react";

interface ClearedEntry {
  matchNumber: number;
  teams: string;
}

export function AdminFixKnockoutsButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    duplicatesCleared: number;
    cleared: ClearedEntry[];
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/fix-knockouts", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Failed");
      else setResult(data);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={run}
        disabled={loading}
        className="px-4 py-2 rounded-xl text-sm font-semibold transition-opacity"
        style={{
          backgroundColor: "#FE7637",
          color: "#fff",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "Fixing…" : "Fix duplicate knockouts"}
      </button>

      {error && (
        <p className="text-sm" style={{ color: "#FE7637" }}>{error}</p>
      )}

      {result && (
        <div className="space-y-1">
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {result.message}
          </p>
          {result.cleared.map((c) => (
            <p key={c.matchNumber} className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Match #{c.matchNumber}: {c.teams} — cleared
            </p>
          ))}
          {result.duplicatesCleared > 0 && (
            <p className="text-xs font-semibold mt-2" style={{ color: "#9685E4" }}>
              Now run Score Sync to repopulate the cleared slots correctly.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
