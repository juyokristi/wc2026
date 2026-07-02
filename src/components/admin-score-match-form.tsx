"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function AdminScoreMatchForm() {
  const [matchNumber, setMatchNumber] = useState("");
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [isAET, setIsAET] = useState(false);
  const [scoreAFull, setScoreAFull] = useState("");
  const [scoreBFull, setScoreBFull] = useState("");
  const [overtime, setOvertime] = useState<"AET" | "PEN">("AET");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    const body: Record<string, unknown> = {
      matchNumber: parseInt(matchNumber),
      scoreA: parseInt(scoreA),
      scoreB: parseInt(scoreB),
    };

    if (isAET) {
      body.scoreAFull = parseInt(scoreAFull);
      body.scoreBFull = parseInt(scoreBFull);
      body.overtime = overtime;
    }

    try {
      const res = await fetch("/api/admin/score-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`Scored ${data.predictionsScored} predictions.`);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch {
      setStatus("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--muted-foreground)" }}>Match #</label>
          <Input
            type="number"
            value={matchNumber}
            onChange={(e) => setMatchNumber(e.target.value)}
            className="w-24"
            placeholder="82"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--muted-foreground)" }}>90' score (A–B)</label>
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              className="w-16 text-center"
              placeholder="2"
              min={0}
              required
            />
            <span style={{ color: "var(--muted-foreground)" }}>–</span>
            <Input
              type="number"
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              className="w-16 text-center"
              placeholder="2"
              min={0}
              required
            />
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--foreground)" }}>
        <input
          type="checkbox"
          checked={isAET}
          onChange={(e) => setIsAET(e.target.checked)}
          className="rounded"
        />
        Went to extra time / penalties
      </label>

      {isAET && (
        <div className="flex items-center gap-3 flex-wrap pl-5">
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--muted-foreground)" }}>Full score (A–B)</label>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                value={scoreAFull}
                onChange={(e) => setScoreAFull(e.target.value)}
                className="w-16 text-center"
                placeholder="3"
                min={0}
                required={isAET}
              />
              <span style={{ color: "var(--muted-foreground)" }}>–</span>
              <Input
                type="number"
                value={scoreBFull}
                onChange={(e) => setScoreBFull(e.target.value)}
                className="w-16 text-center"
                placeholder="2"
                min={0}
                required={isAET}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--muted-foreground)" }}>Type</label>
            <div className="flex gap-2">
              {(["AET", "PEN"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setOvertime(opt)}
                  className="text-xs px-3 py-1.5 rounded-full font-medium"
                  style={{
                    backgroundColor: overtime === opt ? "rgba(150,133,228,0.15)" : "transparent",
                    color: overtime === opt ? "#9685E4" : "var(--muted-foreground)",
                    border: `1px solid ${overtime === opt ? "rgba(150,133,228,0.4)" : "var(--border)"}`,
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="accent" disabled={loading}>
          {loading ? "Saving…" : "Save & rescore"}
        </Button>
        {status && (
          <span className="text-sm" style={{ color: status.startsWith("Error") ? "#FE7637" : "#32BEBF" }}>
            {status}
          </span>
        )}
      </div>
    </form>
  );
}
