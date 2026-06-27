"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface DebugResult {
  summary: {
    totalFdNonGroup: number;
    tbd: number;
    alreadyAssigned: number;
    candidates: number;
    missingCodes: number;
  };
  pendingDbSlots: Record<string, number>;
  candidates: Array<{ fdStage: string; dbStage: string | null; homeTla: string; awayTla: string; homeName: string; awayName: string; utcDate: string }>;
  missingCodes: Array<{ homeTla: string; awayTla: string; homeName: string; awayName: string; issue: string }>;
  tbd: Array<{ fdStage: string; homeName: string; awayName: string; utcDate: string }>;
}

export function AdminFdDebugButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/fd-debug");
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
      <Button variant="accent" onClick={handleCheck} disabled={loading}>
        {loading ? "Checking…" : "Check FD API"}
      </Button>

      {error && (
        <p className="text-sm" style={{ color: "#FE7637" }}>Error: {error}</p>
      )}

      {result && (
        <div className="space-y-3 text-xs" style={{ color: "var(--foreground)" }}>
          <div
            className="rounded-xl px-4 py-3 space-y-1"
            style={{ backgroundColor: "rgba(50,190,191,0.08)", border: "1px solid rgba(50,190,191,0.25)" }}
          >
            <p className="font-semibold" style={{ color: "#32BEBF" }}>FD API summary</p>
            <p>Non-group matches: {result.summary.totalFdNonGroup}</p>
            <p>TBD (not confirmed yet): {result.summary.tbd}</p>
            <p>Already in DB: {result.summary.alreadyAssigned}</p>
            <p style={{ color: result.summary.candidates > 0 ? "#32BEBF" : "var(--muted-foreground)" }}>
              Ready to assign: {result.summary.candidates}
            </p>
            {result.summary.missingCodes > 0 && (
              <p style={{ color: "#FE7637" }}>Team codes missing from DB: {result.summary.missingCodes}</p>
            )}
          </div>

          <div>
            <p className="font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>Pending DB slots by stage</p>
            {Object.entries(result.pendingDbSlots).map(([stage, count]) => (
              <p key={stage}>{stage}: {count} empty</p>
            ))}
          </div>

          {result.candidates.length > 0 && (
            <div>
              <p className="font-semibold mb-1" style={{ color: "#32BEBF" }}>Candidates (sync should assign these)</p>
              {result.candidates.map((c, i) => (
                <p key={i}>
                  {c.homeTla} vs {c.awayTla} — FD stage: {c.fdStage} → DB stage: {c.dbStage ?? "UNKNOWN"} — {new Date(c.utcDate).toLocaleDateString()}
                </p>
              ))}
            </div>
          )}

          {result.missingCodes.length > 0 && (
            <div>
              <p className="font-semibold mb-1" style={{ color: "#FE7637" }}>Missing team codes (add to TLA_MAP or DB)</p>
              {result.missingCodes.map((c, i) => (
                <p key={i}>{c.homeName} ({c.homeTla}) vs {c.awayName} ({c.awayTla}) — {c.issue}</p>
              ))}
            </div>
          )}

          {result.tbd.length > 0 && (
            <div>
              <p className="font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>TBD in FD (groups not finished yet)</p>
              {result.tbd.map((c, i) => (
                <p key={i} style={{ color: "var(--muted-foreground)" }}>
                  {c.fdStage} — {new Date(c.utcDate).toLocaleDateString()}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
