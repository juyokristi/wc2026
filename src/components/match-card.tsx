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
  qualifierPick: string | null;
}

interface MatchCardProps {
  match: {
    id: string;
    matchNumber: number;
    stage: string;
    group: string | null;
    teamAId: string | null;
    teamBId: string | null;
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
    scoreAFull: number | null;
    scoreBFull: number | null;
    overtime: string | null;
    winnerId: string | null;
    status: string;
  };
  prediction: {
    predictedA: number;
    predictedB: number;
    pointsEarned: number | null;
    qualifierPick: string | null;
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
  if (pts === null) return null;
  if (pts >= 7) return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "#F59E0B" }}>
      {pts} pts ⭐⭐
    </span>
  );
  if (pts === 6) return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(150,133,228,0.12)", color: "#9685E4" }}>
      6 pts ⭐+
    </span>
  );
  if (pts === 5) return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(150,133,228,0.12)", color: "#9685E4" }}>
      5 pts ⭐
    </span>
  );
  if (pts === 4) return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(71,126,227,0.12)", color: "#477EE3" }}>
      4 pts
    </span>
  );
  if (pts === 3) return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(50,190,191,0.12)", color: "#32BEBF" }}>
      3 pts
    </span>
  );
  if (pts === 2) return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(150,133,228,0.08)", color: "var(--muted-foreground)" }}>
      2 pts
    </span>
  );
  if (pts === 0) return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(254,118,55,0.1)", color: "#FE7637" }}>
      0 pts
    </span>
  );
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>
      {pts} pts
    </span>
  );
}

export function MatchCard({ match, prediction }: MatchCardProps) {
  const [scoreA, setScoreA] = useState(prediction?.predictedA?.toString() ?? "");
  const [scoreB, setScoreB] = useState(prediction?.predictedB?.toString() ?? "");
  const [qualifierPick, setQualifierPick] = useState<string | null>(prediction?.qualifierPick ?? null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [showPredictions, setShowPredictions] = useState(false);
  const [predictions, setPredictions] = useState<PredictionEntry[] | null>(null);
  const [loadingPredictions, setLoadingPredictions] = useState(false);

  const isKnockout = match.stage !== "GROUP";
  const teamsKnown = match.teamAId != null && match.teamBId != null;

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

  async function save(a: number, b: number, qPick: string | null) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: match.id,
          predictedA: a,
          predictedB: b,
          qualifierPick: qPick,
        }),
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

  function applyAutoQualifier(rawA: string, rawB: string) {
    if (!isKnockout || !teamsKnown) return;
    const a = parseInt(rawA);
    const b = parseInt(rawB);
    if (isNaN(a) || isNaN(b)) return;
    if (a > b) setQualifierPick(match.teamAId!);
    else if (b > a) setQualifierPick(match.teamBId!);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const a = parseInt(scoreA);
    const b = parseInt(scoreB);
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) {
      setError("Enter valid scores");
      return;
    }
    if (isKnockout && teamsKnown && !qualifierPick) {
      setError(a === b ? "Pick who advances in extra time" : "Pick who advances");
      return;
    }
    await save(a, b, qualifierPick);
  }

  async function handleQualifierToggle(teamId: string) {
    if (isLocked) return;
    const next = qualifierPick === teamId ? null : teamId;
    setQualifierPick(next);
    // Auto-save if scores are already entered
    const a = parseInt(scoreA);
    const b = parseInt(scoreB);
    if (!isNaN(a) && !isNaN(b) && a >= 0 && b >= 0) {
      await save(a, b, next);
    }
  }

  async function handleTogglePredictions() {
    if (showPredictions) {
      setShowPredictions(false);
      return;
    }
    setShowPredictions(true);
    if (predictions !== null) return;
    setLoadingPredictions(true);
    try {
      const res = await fetch(`/api/matches/${match.id}/predictions`);
      if (res.ok) setPredictions(await res.json());
    } finally {
      setLoadingPredictions(false);
    }
  }

  // Determine qualifier display for finished matches
  const winnerTeam =
    match.winnerId === match.teamAId
      ? { flag: teamAFlag, code: match.teamA?.code ?? "?" }
      : match.winnerId === match.teamBId
      ? { flag: teamBFlag, code: match.teamB?.code ?? "?" }
      : null;

  return (
    <div
      className="rounded-2xl px-4 py-3 transition-shadow hover:shadow-sm"
      style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        {/* Teams */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl shrink-0">{teamAFlag}</span>
          <span className="text-sm font-medium min-w-0 truncate" style={{ color: "var(--foreground)" }}>{teamAName}</span>
          <span className="text-xs px-1 shrink-0" style={{ color: "var(--muted-foreground)" }}>vs</span>
          <span className="text-sm font-medium min-w-0 truncate" style={{ color: "var(--foreground)" }}>{teamBName}</span>
          <span className="text-2xl shrink-0">{teamBFlag}</span>
        </div>

        {/* Score / input area */}
        <div className="flex items-center gap-2 shrink-0">
          {finished ? (
            <div className="flex flex-col items-end leading-tight">
              <span className="text-base font-bold tabular-nums" style={{ color: "var(--foreground)" }}>
                {match.scoreAFull ?? match.scoreA} – {match.scoreBFull ?? match.scoreB}
                {match.overtime && (
                  <span className="ml-1 text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
                    {match.overtime}
                  </span>
                )}
              </span>
              {match.overtime && match.scoreAFull !== null && (
                <span className="text-xs tabular-nums" style={{ color: "var(--muted-foreground)" }}>
                  90' {match.scoreA}–{match.scoreB}
                </span>
              )}
            </div>
          ) : live ? (
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>
              Locked
            </span>
          ) : isLocked ? (
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>
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
                onChange={(e) => { setScoreA(e.target.value); applyAutoQualifier(e.target.value, scoreB); }}
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
                onChange={(e) => { setScoreB(e.target.value); applyAutoQualifier(scoreA, e.target.value); }}
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

      {/* Qualifier pick row — knockout matches only */}
      {isKnockout && teamsKnown && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Advances:
          </span>
          {finished ? (
            winnerTeam ? (
              <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                {winnerTeam.flag} {winnerTeam.code}
                {prediction?.qualifierPick === match.winnerId && (
                  <span className="ml-1" style={{ color: "#32BEBF" }}>✓ +2 pts</span>
                )}
                {prediction?.qualifierPick != null && prediction.qualifierPick !== match.winnerId && (
                  <span className="ml-1" style={{ color: "#FE7637" }}>✗</span>
                )}
              </span>
            ) : null
          ) : isLocked ? (
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {qualifierPick === match.teamAId
                ? `${teamAFlag} ${match.teamA?.code}`
                : qualifierPick === match.teamBId
                ? `${teamBFlag} ${match.teamB?.code}`
                : "—"}
            </span>
          ) : (
            <>
              {[
                { id: match.teamAId!, flag: teamAFlag, code: match.teamA?.code ?? "?" },
                { id: match.teamBId!, flag: teamBFlag, code: match.teamB?.code ?? "?" },
              ].map((team) => (
                <button
                  key={team.id}
                  onClick={() => handleQualifierToggle(team.id)}
                  disabled={saving}
                  className="text-xs px-2.5 py-1 rounded-full font-medium transition-colors"
                  style={{
                    backgroundColor:
                      qualifierPick === team.id
                        ? "rgba(150,133,228,0.15)"
                        : "transparent",
                    color: qualifierPick === team.id ? "#9685E4" : "var(--muted-foreground)",
                    border: `1px solid ${qualifierPick === team.id ? "rgba(150,133,228,0.4)" : "var(--border)"}`,
                  }}
                >
                  {team.flag} {team.code}
                </button>
              ))}
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                +2 pts if correct
              </span>
            </>
          )}
        </div>
      )}

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
                        <div className="flex items-center justify-center overflow-hidden shrink-0" style={{ width: `${(home / total) * 100}%`, backgroundColor: "#9685E4" }}>
                          {homePct >= 15 && <span className="text-xs font-semibold truncate px-2" style={{ color: "rgba(255,255,255,0.9)" }}>{homePct}% {aCode}</span>}
                        </div>
                      )}
                      {draw > 0 && (
                        <div className="flex items-center justify-center overflow-hidden shrink-0" style={{ width: `${(draw / total) * 100}%`, backgroundColor: "#32BEBF" }}>
                          {drawPct >= 15 && <span className="text-xs font-semibold truncate px-2" style={{ color: "rgba(255,255,255,0.9)" }}>{drawPct}% Draw</span>}
                        </div>
                      )}
                      {away > 0 && (
                        <div className="flex items-center justify-center overflow-hidden shrink-0" style={{ width: `${(away / total) * 100}%`, backgroundColor: "#FE7637" }}>
                          {awayPct >= 15 && <span className="text-xs font-semibold truncate px-2" style={{ color: "rgba(255,255,255,0.9)" }}>{awayPct}% {bCode}</span>}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {isKnockout && (() => {
                  // Infer qualifier from score when not explicitly set (draws with no pick are excluded)
                  const effectivePick = (p: PredictionEntry) =>
                    p.qualifierPick ??
                    (p.predictedA > p.predictedB ? match.teamAId :
                     p.predictedB > p.predictedA ? match.teamBId : null);
                  const picksA = predictions.filter((p) => effectivePick(p) === match.teamAId).length;
                  const picksB = predictions.filter((p) => effectivePick(p) === match.teamBId).length;
                  const totalPicks = picksA + picksB;
                  if (totalPicks === 0) return null;
                  const pctA = Math.round((picksA / totalPicks) * 100);
                  const pctB = Math.round((picksB / totalPicks) * 100);
                  return (
                    <div className="mb-2">
                      <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Advances</p>
                      <div className="flex rounded-xl overflow-hidden" style={{ height: "24px", gap: "2px" }}>
                        {picksA > 0 && (
                          <div className="flex items-center justify-center overflow-hidden shrink-0" style={{ width: `${(picksA / totalPicks) * 100}%`, backgroundColor: "rgba(150,133,228,0.6)" }}>
                            {pctA >= 15 && <span className="text-xs font-semibold truncate px-2" style={{ color: "white" }}>{pctA}% {match.teamA?.code}</span>}
                          </div>
                        )}
                        {picksB > 0 && (
                          <div className="flex items-center justify-center overflow-hidden shrink-0" style={{ width: `${(picksB / totalPicks) * 100}%`, backgroundColor: "rgba(254,118,55,0.6)" }}>
                            {pctB >= 15 && <span className="text-xs font-semibold truncate px-2" style={{ color: "white" }}>{pctB}% {match.teamB?.code}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
                {predictions.map((p, i) => {
                  const effPick = isKnockout
                    ? (p.qualifierPick ??
                       (p.predictedA > p.predictedB ? match.teamAId :
                        p.predictedB > p.predictedA ? match.teamBId : null))
                    : null;
                  return (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span style={{ color: "var(--muted-foreground)" }}>{p.userName}</span>
                      <span className="tabular-nums font-medium flex items-center gap-1.5" style={{ color: "var(--foreground)" }}>
                        {p.predictedA}–{p.predictedB}
                        {effPick && (
                          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                            →{" "}
                            {effPick === match.teamAId
                              ? `${teamAFlag} ${match.teamA?.code}`
                              : `${teamBFlag} ${match.teamB?.code}`}
                          </span>
                        )}
                        {p.pointsEarned !== null && (
                          <span className="ml-0.5" style={{ color: "#9685E4" }}>{p.pointsEarned}pts</span>
                        )}
                      </span>
                    </div>
                  );
                })}
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
