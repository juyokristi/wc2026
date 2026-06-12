"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface SyncResult {
  scoresUpdated: number;
  kickoffsFixed: number;
  checked: number;
}

interface AdminSyncButtonProps {
  doSync: () => Promise<SyncResult>;
}

export function AdminSyncButton({ doSync }: AdminSyncButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await doSync();
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button
        variant="accent"
        onClick={handleSync}
        disabled={loading}
      >
        {loading ? "Syncing…" : "Sync scores now"}
      </Button>

      {result && (
        <div
          className="rounded-2xl px-4 py-3"
          style={{
            backgroundColor: "rgba(50,190,191,0.08)",
            border: "1px solid rgba(50,190,191,0.25)",
          }}
        >
          <p className="text-sm font-medium" style={{ color: "#32BEBF" }}>
            Sync complete
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--foreground)" }}>
            {result.scoresUpdated} scores updated, {result.kickoffsFixed}{" "}
            kickoffs fixed, {result.checked} matches checked
          </p>
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
