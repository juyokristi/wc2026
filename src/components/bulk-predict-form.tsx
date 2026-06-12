"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface OpenMatch {
  id: string;
  matchNumber: number;
  kickoff: string;
  teamA: { name: string; flagEmoji: string; code: string } | null;
  teamB: { name: string; flagEmoji: string; code: string } | null;
  teamALabel: string | null;
  teamBLabel: string | null;
}

export function BulkPredictForm({ matches }: { matches: OpenMatch[] }) {
  const [scores, setScores] = useState<Record<string, { a: string; b: string }>>({});
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setScore(matchId: string, side: "a" | "b", val: string) {
    setScores((prev) => ({
      ...prev,
      [matchId]: { a: "", b: "", ...prev[matchId], [side]: val },
    }));
  }

  const filledIn = Object.entries(scores).filter(([, v]) => v.a !== "" && v.b !== "").length;

  async function handleSave() {
    const predictions = Object.entries(scores)
      .filter(([, v]) => v.a !== "" && v.b !== "")
      .map(([matchId, v]) => ({
        matchId,
        predictedA: parseInt(v.a),
        predictedB: parseInt(v.b),
      }))
      .filter((p) => !isNaN(p.predictedA) && !isNaN(p.predictedB) && p.predictedA >= 0 && p.predictedB >= 0);

    if (predictions.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/predictions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ predictions }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save");
      } else {
        const data = await res.json();
        setSavedCount(data.saved);
        setScores({});
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {savedCount !== null && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: "rgba(50,190,191,0.1)", color: "#32BEBF", border: "1px solid rgba(50,190,191,0.2)" }}
        >
          Saved {savedCount} prediction{savedCount !== 1 ? "s" : ""}. Reload the page to predict any new ones.
        </div>
      )}

      <div className="space-y-2">
        {matches.map((m) => {
          const teamA = m.teamA?.name ?? m.teamALabel ?? "TBD";
          const teamB = m.teamB?.name ?? m.teamBLabel ?? "TBD";
          const flagA = m.teamA?.flagEmoji ?? "🏳";
          const flagB = m.teamB?.flagEmoji ?? "🏳";
          const s = scores[m.id] ?? { a: "", b: "" };

          return (
            <div
              key={m.id}
              className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-base">{flagA}</span>
                <span className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{teamA}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  value={s.a}
                  onChange={(e) => setScore(m.id, "a", e.target.value)}
                  className="w-12 text-center px-1 h-9"
                  style={{ fontSize: "16px", borderRadius: "8px" }}
                  disabled={saving}
                />
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>–</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  value={s.b}
                  onChange={(e) => setScore(m.id, "b", e.target.value)}
                  className="w-12 text-center px-1 h-9"
                  style={{ fontSize: "16px", borderRadius: "8px" }}
                  disabled={saving}
                />
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                <span className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{teamB}</span>
                <span className="text-base">{flagB}</span>
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs" style={{ color: "#FE7637" }}>{error}</p>}

      <div className="flex items-center justify-between gap-4 pt-2">
        <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          {filledIn} of {matches.length} filled in
        </span>
        <Button variant="accent" onClick={handleSave} disabled={saving || filledIn === 0}>
          {saving ? "Saving…" : `Save ${filledIn > 0 ? filledIn : ""} prediction${filledIn !== 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}
