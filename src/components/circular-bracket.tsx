"use client";

import { useMemo, useState, useRef } from "react";
import type { KnockoutMatch, MatchTeam } from "@/components/bracket-view";

interface CircularBracketProps {
  matches: KnockoutMatch[];
}

const OUTER_POSITIONS: Array<[number, "home" | "away"]> = [
  [73, "home"], [73, "away"], [75, "home"], [75, "away"],
  [76, "home"], [76, "away"], [78, "home"], [78, "away"],
  [74, "home"], [74, "away"], [77, "home"], [77, "away"],
  [79, "home"], [79, "away"], [80, "home"], [80, "away"],
  [81, "home"], [81, "away"], [82, "home"], [82, "away"],
  [83, "home"], [83, "away"], [84, "home"], [84, "away"],
  [85, "home"], [85, "away"], [87, "home"], [87, "away"],
  [86, "home"], [86, "away"], [88, "home"], [88, "away"],
];

const DEPTH_MATCHES: number[][] = [
  [],
  [73, 75, 76, 78, 74, 77, 79, 80, 81, 82, 83, 84, 85, 87, 86, 88],
  [89, 90, 91, 92, 93, 94, 95, 96],
  [97, 98, 99, 100],
  [101, 102],
  [104],
];

const CX = 350, CY = 350;
const RADII = [290, 245, 198, 150, 102, 55];
const EMOJI_FONT = "Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif";
const STAGE_LABELS: Record<string, string> = {
  ROUND_OF_32: "Round of 32",
  ROUND_OF_16: "Round of 16",
  QUARTER_FINAL: "Quarter-Final",
  SEMI_FINAL: "Semi-Final",
  THIRD_PLACE: "3rd Place",
  FINAL: "Final",
};

function polar(cx: number, cy: number, r: number, a: number): [number, number] {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function nodeAngle(depth: number, group: number): number {
  return ((group + 0.5) / (32 / Math.pow(2, depth))) * 2 * Math.PI - Math.PI / 2;
}

function teamAngle(i: number): number {
  return (i / 32) * 2 * Math.PI - Math.PI / 2;
}

export function CircularBracket({ matches }: CircularBracketProps) {
  const [hoveredPos, setHoveredPos] = useState<number | null>(null);
  const [hoveredMatchNum, setHoveredMatchNum] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const {
    matchByNum, activeEdges, activePositions, eliminatedPositions,
    liveEdges, livePositions, champion,
  } = useMemo(() => {
    const matchByNum = new Map<number, KnockoutMatch>();
    for (const m of matches) if (m.matchNumber !== null) matchByNum.set(m.matchNumber, m);

    const activeEdges = new Set<string>();
    const liveEdges = new Set<string>();

    for (let d = 1; d <= 5; d++) {
      const nums = DEPTH_MATCHES[d];
      for (let g = 0; g < nums.length; g++) {
        const m = matchByNum.get(nums[g]);
        if (!m) continue;
        if (m.winnerId && (m.teamAId || m.teamBId)) {
          const child = m.winnerId === m.teamAId ? g * 2 : g * 2 + 1;
          activeEdges.add(`${d - 1}:${child}`);
        } else if (m.status === "LIVE") {
          liveEdges.add(`${d - 1}:${g * 2}`);
          liveEdges.add(`${d - 1}:${g * 2 + 1}`);
        }
      }
    }

    const activePositions = new Set<number>();
    const eliminatedPositions = new Set<number>();
    const livePositions = new Set<number>();

    for (let i = 0; i < 32; i++) {
      const [mn, slot] = OUTER_POSITIONS[i];
      const m = matchByNum.get(mn);
      if (!m) continue;
      if (m.status === "LIVE") livePositions.add(i);
      else if (m.winnerId) {
        const tid = slot === "home" ? m.teamAId : m.teamBId;
        if (tid === m.winnerId) activePositions.add(i);
        else eliminatedPositions.add(i);
      }
    }

    const fin = matchByNum.get(104);
    let champion: MatchTeam | null = null;
    if (fin?.winnerId) {
      champion = fin.winnerId === fin.teamAId ? fin.teamA : fin.teamB;
    }

    return { matchByNum, activeEdges, activePositions, eliminatedPositions, liveEdges, livePositions, champion };
  }, [matches]);

  const hoveredPathEdges = useMemo(() => {
    if (hoveredPos === null) return new Set<string>();
    const s = new Set<string>();
    s.add(`0:${hoveredPos}`);
    for (let d = 1; d <= 4; d++) s.add(`${d}:${Math.floor(hoveredPos / Math.pow(2, d))}`);
    return s;
  }, [hoveredPos]);

  const hoveredMatch = hoveredMatchNum !== null ? (matchByNum.get(hoveredMatchNum) ?? null) : null;

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!wrapperRef.current) return;
    const r = wrapperRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - r.left, y: e.clientY - r.top });
  }

  // Build lines
  type Line = { x1: number; y1: number; x2: number; y2: number; active: boolean; live: boolean; ek: string };
  const lines: Line[] = [];

  for (let i = 0; i < 32; i++) {
    const ek = `0:${i}`;
    const [tx, ty] = polar(CX, CY, RADII[0], teamAngle(i));
    const [nx, ny] = polar(CX, CY, RADII[1], nodeAngle(1, Math.floor(i / 2)));
    lines.push({ x1: tx, y1: ty, x2: nx, y2: ny, active: activeEdges.has(ek), live: liveEdges.has(ek) || livePositions.has(i), ek });
  }
  for (let g = 0; g < 16; g++) {
    const ek = `1:${g}`;
    const [fx, fy] = polar(CX, CY, RADII[1], nodeAngle(1, g));
    const [tx, ty] = polar(CX, CY, RADII[2], nodeAngle(2, Math.floor(g / 2)));
    lines.push({ x1: fx, y1: fy, x2: tx, y2: ty, active: activeEdges.has(ek), live: liveEdges.has(ek), ek });
  }
  for (let k = 0; k < 8; k++) {
    const ek = `2:${k}`;
    const [fx, fy] = polar(CX, CY, RADII[2], nodeAngle(2, k));
    const [tx, ty] = polar(CX, CY, RADII[3], nodeAngle(3, Math.floor(k / 2)));
    lines.push({ x1: fx, y1: fy, x2: tx, y2: ty, active: activeEdges.has(ek), live: liveEdges.has(ek), ek });
  }
  for (let l = 0; l < 4; l++) {
    const ek = `3:${l}`;
    const [fx, fy] = polar(CX, CY, RADII[3], nodeAngle(3, l));
    const [tx, ty] = polar(CX, CY, RADII[4], nodeAngle(4, Math.floor(l / 2)));
    lines.push({ x1: fx, y1: fy, x2: tx, y2: ty, active: activeEdges.has(ek), live: liveEdges.has(ek), ek });
  }
  for (let m2 = 0; m2 < 2; m2++) {
    const ek = `4:${m2}`;
    const [fx, fy] = polar(CX, CY, RADII[4], nodeAngle(4, m2));
    lines.push({ x1: fx, y1: fy, x2: CX, y2: CY, active: activeEdges.has(ek), live: liveEdges.has(ek), ek });
  }

  const TW = 185;
  const tooltipLeft = mousePos && wrapperRef.current
    ? (mousePos.x + TW + 16 > wrapperRef.current.offsetWidth ? mousePos.x - TW - 8 : mousePos.x + 12)
    : 0;
  const tooltipTop = mousePos ? Math.max(8, mousePos.y - 50) : 0;

  const showTooltip = (hoveredMatch !== null || hoveredPos !== null) && mousePos !== null;

  return (
    <div
      ref={wrapperRef}
      style={{ width: "100%", maxWidth: 700, margin: "0 auto", position: "relative" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { setHoveredPos(null); setHoveredMatchNum(null); setMousePos(null); }}
    >
      <svg
        viewBox="0 0 700 700"
        style={{ width: "100%", height: "auto", display: "block" }}
        aria-label="World Cup 2026 bracket"
      >
        <circle cx={CX} cy={CY} r={320} fill="#0a0a12" />
        {RADII.map((r, i) => (
          <circle key={i} cx={CX} cy={CY} r={r} fill="none" stroke="#1a1a28" strokeWidth={1} />
        ))}

        {/* Base lines */}
        {lines.map((l, i) => {
          if (l.live || l.active || hoveredPathEdges.has(l.ek)) return null;
          return (
            <line key={`b${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke={hoveredPos !== null ? "#161624" : "#252538"} strokeWidth={1} strokeLinecap="round" />
          );
        })}
        {/* Active (winner) lines */}
        {lines.map((l, i) => {
          if (!l.active || l.live) return null;
          const hp = hoveredPathEdges.has(l.ek);
          return (
            <line key={`a${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke={hp ? "#FE7637" : "#9685E4"} strokeWidth={hp ? 2.5 : 2} strokeLinecap="round" />
          );
        })}
        {/* Hovered path (not yet won — dashed) */}
        {lines.map((l, i) => {
          if (!hoveredPathEdges.has(l.ek) || l.active || l.live) return null;
          return (
            <line key={`h${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="#FE7637" strokeWidth={1.5} strokeLinecap="round" strokeDasharray="3 2" />
          );
        })}
        {/* Live lines */}
        {lines.map((l, i) => {
          if (!l.live) return null;
          return (
            <line key={`v${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="#32BEBF" strokeWidth={2} strokeLinecap="round" />
          );
        })}

        {/* Match nodes at depths 1-4 */}
        {[1, 2, 3, 4].flatMap((d) =>
          Array.from({ length: 32 / Math.pow(2, d) }, (_, g) => {
            const ang = nodeAngle(d, g);
            const [nx, ny] = polar(CX, CY, RADII[d], ang);
            const ekA = `${d - 1}:${g * 2}`, ekB = `${d - 1}:${g * 2 + 1}`;
            const isLive = liveEdges.has(ekA) || liveEdges.has(ekB);
            const isActive = activeEdges.has(ekA) || activeEdges.has(ekB);
            const matchNum = DEPTH_MATCHES[d][g];
            const isHov = matchNum === hoveredMatchNum;
            const isOnPath = hoveredPos !== null && (hoveredPathEdges.has(ekA) || hoveredPathEdges.has(ekB));
            const nr = 1.5 + d * 0.6;
            return (
              <g key={`n${d}-${g}`}
                onMouseEnter={() => { setHoveredMatchNum(matchNum); setHoveredPos(null); }}
                onMouseLeave={() => setHoveredMatchNum(null)}
                style={{ cursor: "pointer" }}
              >
                <circle cx={nx} cy={ny} r={12} fill="transparent" />
                {isHov && (
                  <circle cx={nx} cy={ny} r={nr + 5} fill="none"
                    stroke={isLive ? "#32BEBF" : "#9685E4"} strokeWidth={1} opacity={0.4} />
                )}
                <circle cx={nx} cy={ny}
                  r={isHov ? nr + 1.5 : nr}
                  fill={
                    isHov ? (isLive ? "#32BEBF" : "#9685E4")
                      : isLive ? "#32BEBF"
                      : isActive ? "#9685E4"
                      : isOnPath ? "#FE7637"
                      : "#252538"
                  }
                />
              </g>
            );
          })
        )}

        {/* Center: Final / Trophy */}
        <g
          onMouseEnter={() => { setHoveredMatchNum(104); setHoveredPos(null); }}
          onMouseLeave={() => setHoveredMatchNum(null)}
          style={{ cursor: "pointer" }}
        >
          <circle cx={CX} cy={CY} r={42} fill="transparent" />
          <circle cx={CX} cy={CY} r={hoveredMatchNum === 104 ? 35 : 33}
            fill={champion ? "#1a1a28" : "#141420"}
            stroke={hoveredMatchNum === 104 ? "#FE7637" : champion ? "#9685E4" : "#2a2a3e"}
            strokeWidth={hoveredMatchNum === 104 || champion ? 1.5 : 1}
          />
          <text x={CX} y={CY} textAnchor="middle" dominantBaseline="central"
            fontSize={26} style={{ fontFamily: EMOJI_FONT, userSelect: "none", pointerEvents: "none" }}>
            {champion ? champion.flagEmoji : "🏆"}
          </text>
        </g>

        {/* Team badges */}
        {OUTER_POSITIONS.map(([matchNum, slot], i) => {
          const m = matchByNum.get(matchNum);
          const team = slot === "home" ? m?.teamA : m?.teamB;
          const label = team?.name ?? (slot === "home" ? m?.teamALabel : m?.teamBLabel) ?? "TBD";
          const flag = team?.flagEmoji ?? "🏳";
          const isElim = eliminatedPositions.has(i);
          const isActive = activePositions.has(i);
          const isLive = livePositions.has(i);
          const isHov = hoveredPos === i;
          const anyHov = hoveredPos !== null;
          const opacity = isElim && !isHov ? 0.25 : anyHov && !isHov ? 0.45 : 1;
          const ang = teamAngle(i);
          const [bx, by] = polar(CX, CY, RADII[0], ang);
          const stroke = isHov ? "#FE7637" : isLive ? "#32BEBF" : isActive ? "#9685E4" : "#2a2a3e";

          return (
            <g key={`t${i}`} opacity={opacity}
              onMouseEnter={() => { setHoveredPos(i); setHoveredMatchNum(null); }}
              onMouseLeave={() => setHoveredPos(null)}
              style={{ cursor: "pointer" }}
            >
              <title>{label}</title>
              <circle cx={bx} cy={by} r={18} fill="transparent" />
              <circle cx={bx} cy={by} r={isHov ? 16 : 14}
                fill="#141420" stroke={stroke}
                strokeWidth={(isActive || isLive || isHov) ? 1.5 : 1} />
              <text x={bx} y={by} textAnchor="middle" dominantBaseline="central"
                fontSize={isHov ? 14 : 13}
                style={{ fontFamily: EMOJI_FONT, userSelect: "none", pointerEvents: "none" }}>
                {flag}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating tooltip */}
      {showTooltip && (
        <div style={{
          position: "absolute",
          left: tooltipLeft,
          top: tooltipTop,
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "8px 12px",
          pointerEvents: "none",
          zIndex: 10,
          width: TW,
        }}>
          {hoveredMatch ? (
            <>
              <p style={{ color: "#9685E4", fontSize: 10, fontWeight: 700, marginBottom: 5 }}>
                {STAGE_LABELS[hoveredMatch.stage] ?? hoveredMatch.stage}
              </p>
              <div style={{ fontSize: 12, lineHeight: "1.7" }}>
                <p style={{ color: "var(--foreground)" }}>
                  {hoveredMatch.teamA?.flagEmoji ?? "🏳"} {hoveredMatch.teamA?.name ?? hoveredMatch.teamALabel ?? "TBD"}
                </p>
                {(hoveredMatch.status === "FINISHED" || hoveredMatch.status === "LIVE") && hoveredMatch.scoreA !== null ? (
                  <p style={{ color: "var(--muted-foreground)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px" }}>
                    {hoveredMatch.scoreA} — {hoveredMatch.scoreB}
                    {hoveredMatch.status === "LIVE" && (
                      <span style={{ color: "#32BEBF", marginLeft: 6 }}>● LIVE</span>
                    )}
                  </p>
                ) : (
                  <p style={{ color: "var(--muted-foreground)", fontSize: 10 }}>
                    {new Date(hoveredMatch.kickoff).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                    {" · "}
                    {new Date(hoveredMatch.kickoff).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
                <p style={{ color: "var(--foreground)" }}>
                  {hoveredMatch.teamB?.flagEmoji ?? "🏳"} {hoveredMatch.teamB?.name ?? hoveredMatch.teamBLabel ?? "TBD"}
                </p>
              </div>
              {hoveredMatch.status === "FINISHED" && hoveredMatch.winnerId && (
                <p style={{ color: "#9685E4", fontSize: 10, marginTop: 4 }}>
                  Winner: {hoveredMatch.winnerId === hoveredMatch.teamAId
                    ? (hoveredMatch.teamA?.name ?? "Team A")
                    : (hoveredMatch.teamB?.name ?? "Team B")}
                </p>
              )}
            </>
          ) : hoveredPos !== null ? (() => {
            const [mn, slot] = OUTER_POSITIONS[hoveredPos];
            const m = matchByNum.get(mn);
            const team = slot === "home" ? m?.teamA : m?.teamB;
            const name = team?.name ?? (slot === "home" ? m?.teamALabel : m?.teamBLabel) ?? "TBD";
            const flag = team?.flagEmoji ?? "🏳";
            const isElim = eliminatedPositions.has(hoveredPos);
            const isActive = activePositions.has(hoveredPos);
            const isLive = livePositions.has(hoveredPos);
            const statusText = isLive ? "● LIVE now" : isActive ? "Still in bracket" : isElim ? "Eliminated" : "TBD";
            const statusColor = isLive ? "#32BEBF" : isActive ? "#9685E4" : "var(--muted-foreground)";
            return (
              <>
                <p style={{ fontSize: 15, marginBottom: 3 }}>
                  {flag} <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{name}</span>
                </p>
                <p style={{ color: statusColor, fontSize: 10, fontWeight: isLive || isActive ? 700 : 400 }}>
                  {statusText}
                </p>
              </>
            );
          })() : null}
        </div>
      )}
    </div>
  );
}
