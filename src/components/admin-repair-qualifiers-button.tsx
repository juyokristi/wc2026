"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface RepairResult {
  scanned: number;
  fixed: number;
  bonusAwarded: number;
  details: { user: string; match: number; pts: number; newPts: number }[];
}

export function AdminRepairQualifiersButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RepairResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRepair() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/repair-qualifiers", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button variant="accent" onClick={handleRepair} disabled={loading}>
        {loading ? "Scanning…" : "Repair qualifier picks"}
      </Button>

      {result && (
        <div
          className="rounded-2xl px-4 py-3 space-y-2"
          style={{ backgroundColor: "rgba(50,190,191,0.08)", border: "1px solid rgba(50,190,191,0.25)" }}
        >
          <p className="text-sm font-medium" style={{ color: "#32BEBF" }}>
            Done — {result.scanned} scanned · {result.fixed} fixed · {result.bonusAwarded} bonus awarded
          </p>
          {result.details.length > 0 ? (
            <div className="space-y-1">
              {result.details.map((d, i) => (
                <p key={i} className="text-xs" style={{ color: "var(--foreground)" }}>
                  {d.user} · match #{d.match} · {d.pts} → {d.newPts} pts
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Nothing to fix.</p>
          )}
        </div>
      )}

      {error && (
        <div
          className="rounded-2xl px-4 py-3"
          style={{ backgroundColor: "rgba(254,118,55,0.08)", border: "1px solid rgba(254,118,55,0.25)" }}
        >
          <p className="text-sm font-medium" style={{ color: "#FE7637" }}>Error: {error}</p>
        </div>
      )}
    </div>
  );
}
