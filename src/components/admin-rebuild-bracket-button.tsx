"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface RebuildResult {
  kickoffsUpdated: number;
  teamsAssigned: number;
  stageSummary: Record<string, { fdCount: number; dbCount: number; updated: number }>;
  unseenFdStages: string[];
}

export function AdminRebuildBracketButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RebuildResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRebuild() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/rebuild-bracket", { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Request failed");
      } else {
        setResult(await res.json());
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button variant="accent" onClick={handleRebuild} disabled={loading}>
        {loading ? "Rebuilding…" : "Rebuild bracket from FD"}
      </Button>

      {error && <p className="text-sm" style={{ color: "#FE7637" }}>Error: {error}</p>}

      {result && (
        <div
          className="rounded-xl px-4 py-3 space-y-1 text-xs"
          style={{ backgroundColor: "rgba(50,190,191,0.08)", border: "1px solid rgba(50,190,191,0.25)" }}
        >
          <p className="font-semibold" style={{ color: "#32BEBF" }}>Rebuild complete</p>
          <p>{result.kickoffsUpdated} slots updated · {result.teamsAssigned} new team assignments</p>
          {Object.entries(result.stageSummary).map(([stage, s]) => (
            <p key={stage} style={{ color: "var(--muted-foreground)" }}>
              {stage}: {s.updated}/{Math.min(s.fdCount, s.dbCount)} updated (FD: {s.fdCount}, DB: {s.dbCount})
            </p>
          ))}
          {result.unseenFdStages.length > 0 && (
            <p style={{ color: "#FE7637" }}>
              Unknown FD stages (add to FD_STAGE_MAP): {result.unseenFdStages.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
