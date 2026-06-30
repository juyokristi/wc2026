"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface RebuildResult {
  assigned: number;
  labelsUpdated: number;
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
        {loading ? "Rebuilding…" : "Rebuild bracket"}
      </Button>

      {error && <p className="text-sm" style={{ color: "#FE7637" }}>Error: {error}</p>}

      {result && (
        <div
          className="rounded-xl px-4 py-3 space-y-1 text-xs"
          style={{ backgroundColor: "rgba(50,190,191,0.08)", border: "1px solid rgba(50,190,191,0.25)" }}
        >
          <p className="font-semibold" style={{ color: "#32BEBF" }}>Rebuild complete</p>
          <p>{result.assigned} slot{result.assigned !== 1 ? "s" : ""} assigned · {result.labelsUpdated} label{result.labelsUpdated !== 1 ? "s" : ""} updated</p>
        </div>
      )}
    </div>
  );
}
