"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface FixResult {
  pairingsFixed: number;
  kickoffsUpdated: number;
  skipped: number;
  changes: string[];
}

export function AdminFixPairingsButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FixResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showChanges, setShowChanges] = useState(false);

  async function handleFix() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/fix-pairings", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed");
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
      <Button variant="outline" onClick={handleFix} disabled={loading}>
        {loading ? "Fixing…" : "Fix group pairings"}
      </Button>

      {result && (
        <div
          className="rounded-2xl px-4 py-3 space-y-1"
          style={{
            backgroundColor: "rgba(50,190,191,0.08)",
            border: "1px solid rgba(50,190,191,0.25)",
          }}
        >
          <p className="text-sm font-medium" style={{ color: "#32BEBF" }}>
            Done — {result.pairingsFixed} pairings fixed, {result.kickoffsUpdated} kickoffs updated, {result.skipped} skipped
          </p>
          {result.changes.length > 0 && (
            <button
              className="text-xs underline"
              style={{ color: "var(--muted-foreground)" }}
              onClick={() => setShowChanges((v) => !v)}
            >
              {showChanges ? "Hide" : "Show"} details ({result.changes.length})
            </button>
          )}
          {showChanges && (
            <ul className="text-xs space-y-0.5 mt-1" style={{ color: "var(--muted-foreground)" }}>
              {result.changes.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <div
          className="rounded-2xl px-4 py-3"
          style={{
            backgroundColor: "rgba(254,118,55,0.08)",
            border: "1px solid rgba(254,118,55,0.25)",
          }}
        >
          <p className="text-sm font-medium" style={{ color: "#FE7637" }}>
            Error: {error}
          </p>
        </div>
      )}
    </div>
  );
}
