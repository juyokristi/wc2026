"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ThirdPlaceEntry {
  rank: number;
  group: string;
  name: string;
  pts: number;
  gd: number;
  gf: number;
}

interface PopulateResult {
  assigned: number;
  skipped: number;
  details: string[];
  incompleteGroups: string[];
  thirdPlaceRanking: ThirdPlaceEntry[];
}

export function AdminPopulateR32Button() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PopulateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePopulate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/populate-r32", { method: "POST" });
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
      <Button variant="accent" onClick={handlePopulate} disabled={loading}>
        {loading ? "Populating…" : "Populate R32 from standings"}
      </Button>

      {error && <p className="text-sm" style={{ color: "#FE7637" }}>Error: {error}</p>}

      {result && (
        <div
          className="rounded-xl px-4 py-3 space-y-2 text-xs"
          style={{ backgroundColor: "rgba(50,190,191,0.08)", border: "1px solid rgba(50,190,191,0.25)" }}
        >
          <p className="font-semibold" style={{ color: "#32BEBF" }}>
            Done — {result.assigned} slots assigned{result.skipped > 0 ? `, ${result.skipped} skipped` : ""}
          </p>
          {result.incompleteGroups.length > 0 && (
            <p style={{ color: "#FE7637" }}>
              Incomplete groups (best3rd slots pending): {result.incompleteGroups.join(", ")}
            </p>
          )}

          {result.thirdPlaceRanking.length > 0 && (
            <div className="pt-1">
              <p className="font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>
                3rd-place ranking (from finished groups)
              </p>
              <div className="space-y-0.5">
                {result.thirdPlaceRanking.map((t) => (
                  <p key={t.group} style={{ color: t.rank <= 8 ? "var(--foreground)" : "var(--muted-foreground)" }}>
                    {t.rank <= 8 ? "✓" : " "} #{t.rank} 3rd Group {t.group} — {t.name} ({t.pts}pts, {t.gd > 0 ? "+" : ""}{t.gd} GD, {t.gf} GF)
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-0.5 pt-1" style={{ color: "var(--muted-foreground)" }}>
            {result.details.map((d, i) => (
              <p key={i}>{d}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
