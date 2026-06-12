"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface PredictionEntry {
  userName: string;
  userImage: string | null;
  predictedA: number;
  predictedB: number;
  pointsEarned: number | null;
}

interface MatchCardProps {
  match: {
    id: string;
    matchNumber: number;
    stage: string;
    group: string | null;
    teamALabel: string | null;
    teamBLabel: string | null;
    teamA: { name: string; flagEmoji: string; code: string } | null;
    teamB: { name: string; flagEmoji: string; code: string } | null;
    kickoff: string;
    venue: string;
    city: string;
    country: string;
    scoreA: number | null;
    scoreB: number | null;
    status: string;
  };
  prediction: {
    predictedA: number;
    predictedB: number;
    pointsEarned: number | null;
  } | null;
}

function formatKickoff(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Europe/Paris",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) + " CEST";
}

function PointsBadge({ pts }: { pts: number | null }) {
  if (pts === 5) return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(150,133,228,0.12)", color: "#9685E4" }}>5 pts ⭐</span>
  );
  if (pts === 4) return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(71,126,227,0.12)", color: "#477EE3" }}>4 pts</span>
  );
  if (pts === 3) return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(50,190,191,0.12)", color: "#32BEBF" }}>3 pts</span>
  );
  if (pts === 0) return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(254,118,55,0.1)", color: "#FE7637" }}>0 pts</span>
  );
  return null;
}

export function MatchCard({ match, prediction }: MatchCardProps) {
  const [scoreA, setScoreA] = useState(prediction?.predictedA?.toString() ?? "");
  const [scoreB, setScoreB] = useState(prediction?.predictedB?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [showPredictions, setShowPredictions] = useState(false);
  const [predictions, setPredictions] = useState<PredictionEntry[] | null>(null);
  const [loadingPredictions, setLoadingPredictions] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsLocked(new Date(match.kickoff) <= new Date());
      const diff = new Date(match.kickoff).getTime() - Date.now();
      if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setCountdown(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
      } else {
        setCountdown(null);
      }
    };
    check();
    const t = setInterval(check, 1000);
    return () => clearInterval(t);
  }, [match.kickoff]);

  const teamAName = match.teamA?.name ?? match.teamALabel ?? "TBD";
  const teamBName = match.teamB?.name ?? match.teamBLabel ?? "TBD";
  const teamAFlag = match.teamA?.flagEmoji ?? "🏳";
  const teamBFlag = match.teamB?.flagEmoji ?? "🏳";
  const finished = match.status === "FINISHED";
  const live = match.status === "LIVE";

  async function handleTogglePredictions() {
    if (showPredictions) {
      setShowPredictions(false);
      return;
    }
    setShowPredictions(true);
    if (predictions !== null) return; // already loaded
    setLoadingPredictions(true);
    try {
      const res = await fetch(`/api/matches/${match.id}/predictions`);
      if (res.ok) setPredictions(await res.json());
    } finally {
      setLoadingPredictions(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const a = parseInt(scoreA);
    const b = parseInt(scoreB);
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) {
      setError("Enter valid scores");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: match.id, predictedA: a, predictedB: b }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-2xl px-4 py-3 transition-shadow hover:shadow-sm"
      style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        {/* Teams */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">{teamAFlag}</span>
          <span className="text-sm font-medium min-w-0 truncate" style={{ color: "var(--foreground)" }}>{teamAName}</span>
          <span className="text-xs px-1 shrink-0" style={{ color: "var(--muted-foreground)" }}>vs</span>
          <span className="text-sm font-medium min-w-0 truncate" style={{ color: "var(--foreground)" }}>{teamBName}</span>
          <span className="text-lg shrink-0">{teamBFlag}</span>
        </div>

        {/* Score / input area */}
        <div className="flex items-center gap-2 shrink-0">
          {finished ? (
            <span className="text-base font-bold tabular-nums" style={{ color: "var(--foreground)" }}>
              {match.scoreA} – {match.scoreB}
            </span>
          ) : live ? (
            <span
              className="text-xs px-2.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}
            >
              Locked
            </span>
          ) : isLocked ? (
            <span
              className="text-xs px-2.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}
            >
              Locked
            </span>
          ) : (
            <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value)}
                className="w-12 text-center px-1 h-9 sm:h-8"
                style={{ borderRadius: "8px", fontSize: "16px" }}
                disabled={saving}
              />
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>–</span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value)}
                className="w-12 text-center px-1 h-9 sm:h-8"
                style={{ borderRadius: "8px", fontSize: "16px" }}
                disabled={saving}
              />
              <Button type="submit" size="sm" variant="accent" disabled={saving}>
                {saving ? "…" : saved ? "Saved" : "Save"}
              </Button>
            </form>
          )}

          {prediction?.pointsEarned !== undefined && <PointsBadge pts={prediction.pointsEarned} />}

          {prediction && !finished && !isLocked && prediction.predictedA !== undefined && (
            <span className="text-xs tabular-nums" style={{ color: "var(--muted-foreground)" }}>
              {prediction.predictedA}–{prediction.predictedB}
            </span>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="mt-1.5 flex items-center gap-3 text-xs flex-wrap" style={{ color: "var(--muted-foreground)" }}>
        <span>#{match.matchNumber}</span>
        <span>{formatKickoff(match.kickoff)}</span>
        {live && (
          <span className="font-semibold animate-pulse" style={{ color: "#32BEBF" }}>● LIVE</span>
        )}
        {!isLocked && !finished && !live && countdown !== null && (
          <span className="font-medium tabular-nums" style={{ color: "#FE7637" }}>⏱ {countdown}</span>
        )}
        {!isLocked && !finished && !live && countdown === null && (
          <span className="font-medium" style={{ color: "#32BEBF" }}>Open</span>
        )}
      </div>

      {error && <p className="mt-1 text-xs" style={{ color: "#FE7637" }}>{error}</p>}

      <div className="mt-2">
          <button
            className="text-xs font-medium"
            style={{ color: "var(--muted-foreground)" }}
            onClick={handleTogglePredictions}
          >
            {showPredictions ? "Hide predictions" : "Community predictions"}
          </button>
          {showPredictions && (
            <div className="mt-2 space-y-1">
              {loadingPredictions ? (
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Loading…</p>
              ) : predictions?.length ? (
                <>
                  {(() => {
                    const home = predictions.filter((p) => p.predictedA > p.predictedB).length;
                    const draw = predictions.filter((p) => p.predictedA === p.predictedB).length;
                    const away = predictions.filter((p) => p.predictedA < p.predictedB).length;
                    const total = predictions.length;
                    const homePct = Math.round((home / total) * 100);
                    const drawPct = Math.round((draw / total) * 100);
                    const awayPct = Math.round((away / total) * 100);
                    const aCode = match.teamA?.code ?? teamAName.split(" ")[0];
                    const bCode = match.teamB?.code ?? teamBName.split(" ")[0];
                    return (
                      <div className="flex rounded-xl overflow-hidden mb-3" style={{ height: "28px", gap: "2px" }}>
                        {home > 0 && (
                          <div
                            className="flex items-center justify-center overflow-hidden shrink-0"
                            style={{ width: `${(home / total) * 100}%`, backgroundColor: "#9685E4" }}
                          >
                            {homePct >= 15 && (
                              <span className="text-xs font-semibold truncate px-2" style={{ color: "rgba(255,255,255,0.9)" }}>
                                {homePct}% {aCode}
                              </span>
                            )}
                          </div>
                        )}
                        {draw > 0 && (
                          <div
                            className="flex items-center justify-center overflow-hidden shrink-0"
                            style={{ width: `${(draw / total) * 100}%`, backgroundColor: "#32BEBF" }}
                          >
                            {drawPct >= 15 && (
                              <span className="text-xs font-semibold truncate px-2" style={{ color: "rgba(255,255,255,0.9)" }}>
                                {drawPct}% Draw
                              </span>
                            )}
                          </div>
                        )}
                        {away > 0 && (
                          <div
                            className="flex items-center justify-center overflow-hidden shrink-0"
                            style={{ width: `${(away / total) * 100}%`, backgroundColor: "#FE7637" }}
                          >
                            {awayPct >= 15 && (
                              <span className="text-xs font-semibold truncate px-2" style={{ color: "rgba(255,255,255,0.9)" }}>
                                {awayPct}% {bCode}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {predictions.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span style={{ color: "var(--muted-foreground)" }}>{p.userName}</span>
                      <span className="tabular-nums font-medium" style={{ color: "var(--foreground)" }}>
                        {p.predictedA}–{p.predictedB}
                        {p.pointsEarned !== null && (
                          <span className="ml-1.5" style={{ color: "#9685E4" }}>{p.pointsEarned}pts</span>
                        )}
                      </span>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>No predictions yet.</p>
              )}
            </div>
          )}
        </div>
    </div>
  );
}
