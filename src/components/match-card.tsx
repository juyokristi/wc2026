"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pointsBadgeColor(pts: number | null) {
  if (pts === null) return "secondary";
  if (pts === 5) return "default";
  if (pts >= 3) return "outline";
  return "destructive";
}

export function MatchCard({ match, prediction }: MatchCardProps) {
  const [scoreA, setScoreA] = useState(prediction?.predictedA?.toString() ?? "");
  const [scoreB, setScoreB] = useState(prediction?.predictedB?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const check = () => setIsLocked(new Date(match.kickoff) <= new Date());
    check();
    const t = setInterval(check, 10000);
    return () => clearInterval(t);
  }, [match.kickoff]);

  const teamAName = match.teamA?.name ?? match.teamALabel ?? "TBD";
  const teamBName = match.teamB?.name ?? match.teamBLabel ?? "TBD";
  const teamAFlag = match.teamA?.flagEmoji ?? "🏳";
  const teamBFlag = match.teamB?.flagEmoji ?? "🏳";

  const finished = match.status === "FINISHED";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const a = parseInt(scoreA);
    const b = parseInt(scoreB);
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) {
      setError("Enter valid scores (0 or more)");
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
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Teams */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-xl">{teamAFlag}</span>
            <span className="font-medium truncate">{teamAName}</span>
            <span className="text-muted-foreground text-sm mx-1">vs</span>
            <span className="font-medium truncate">{teamBName}</span>
            <span className="text-xl">{teamBFlag}</span>
          </div>

          {/* Score inputs or result */}
          <div className="flex items-center gap-2">
            {finished ? (
              <div className="flex items-center gap-1 text-lg font-bold">
                <span>{match.scoreA}</span>
                <span className="text-muted-foreground">–</span>
                <span>{match.scoreB}</span>
              </div>
            ) : isLocked ? (
              <Badge variant="secondary">Locked</Badge>
            ) : (
              <form onSubmit={handleSubmit} className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={99}
                  value={scoreA}
                  onChange={(e) => setScoreA(e.target.value)}
                  className="w-14 text-center"
                  disabled={saving}
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="number"
                  min={0}
                  max={99}
                  value={scoreB}
                  onChange={(e) => setScoreB(e.target.value)}
                  className="w-14 text-center"
                  disabled={saving}
                />
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "…" : saved ? "✓" : "Save"}
                </Button>
              </form>
            )}

            {/* Points badge */}
            {prediction?.pointsEarned !== undefined && prediction.pointsEarned !== null && (
              <Badge variant={pointsBadgeColor(prediction.pointsEarned)}>
                {prediction.pointsEarned} pts
              </Badge>
            )}
            {prediction && !finished && !isLocked && (
              <span className="text-xs text-muted-foreground">
                ({prediction.predictedA}–{prediction.predictedB})
              </span>
            )}
          </div>
        </div>

        {/* Metadata row */}
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span>#{match.matchNumber}</span>
          <span>{formatKickoff(match.kickoff)}</span>
          <span>{match.venue}, {match.city}</span>
          {!isLocked && !finished && (
            <span className="text-amber-500 font-medium">Open for predictions</span>
          )}
        </div>

        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
