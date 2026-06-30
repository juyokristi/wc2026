"use client";

import { useMemo } from "react";

interface MatchTeam {
  name: string;
  flagEmoji: string;
  code: string;
}

interface KnockoutMatch {
  id: string;
  matchNumber: number | null;
  stage: string;
  status: string;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  teamAId: string | null;
  teamBId: string | null;
  teamA: MatchTeam | null;
  teamB: MatchTeam | null;
  teamALabel: string | null;
  teamBLabel: string | null;
}

interface CircularBracketProps {
  matches: KnockoutMatch[];
}

// Outer position order: 32 slots clockwise from top.
// Each pair of adjacent positions are R32 opponents.
// Groups of 4 → same R16 match. Groups of 8 → same QF match.
const OUTER_POSITIONS: Array<[number, "home" | "away"]> = [
  [73, "home"], [73, "away"], [75, "home"], [75, "away"],  // → R16 M1 (89)
  [76, "home"], [76, "away"], [78, "home"], [78, "away"],  // → R16 M2 (90)
  [74, "home"], [74, "away"], [77, "home"], [77, "away"],  // → R16 M3 (91)
  [79, "home"], [79, "away"], [80, "home"], [80, "away"],  // → R16 M4 (92)
  [81, "home"], [81, "away"], [82, "home"], [82, "away"],  // → R16 M5 (93)
  [83, "home"], [83, "away"], [84, "home"], [84, "away"],  // → R16 M6 (94)
  [85, "home"], [85, "away"], [87, "home"], [87, "away"],  // → R16 M7 (95)
  [86, "home"], [86, "away"], [88, "home"], [88, "away"],  // → R16 M8 (96)
];

// Match numbers by depth
const DEPTH_MATCHES: number[][] = [
  [],                                                   // depth 0 (outer teams, no match)
  [73, 75, 76, 78, 74, 77, 79, 80, 81, 82, 83, 84, 85, 87, 86, 88], // depth 1 (R32, 16 groups)
  [89, 90, 91, 92, 93, 94, 95, 96],                    // depth 2 (R16, 8 groups)
  [97, 98, 99, 100],                                    // depth 3 (QF, 4 groups)
  [101, 102],                                           // depth 4 (SF, 2 groups)
  [104],                                                // depth 5 (Final, 1 group)
];

const CX = 350;
const CY = 350;
// Radii: depth 0 = teams outer ring, depth 5 = just before center
const RADII = [290, 245, 198, 150, 102, 55];

const EMOJI_FONT = "Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif";

function polar(cx: number, cy: number, r: number, angle: number): [number, number] {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

function nodeAngle(depth: number, group: number): number {
  const groupCount = 32 / Math.pow(2, depth);
  return ((group + 0.5) / groupCount) * 2 * Math.PI - Math.PI / 2;
}

function teamAngle(posIndex: number): number {
  return (posIndex / 32) * 2 * Math.PI - Math.PI / 2;
}

export function CircularBracket({ matches }: CircularBracketProps) {
  const { matchByNum, activeEdges, activePositions, eliminatedPositions, liveEdges, livePositions, champion } =
    useMemo(() => {
      const matchByNum = new Map<number, KnockoutMatch>();
      for (const m of matches) {
        if (m.matchNumber !== null) matchByNum.set(m.matchNumber, m);
      }

      // activeEdges: Set of "depth:group" strings for winner paths
      // liveEdges: Set of "depth:group" strings for currently live paths
      const activeEdges = new Set<string>();
      const liveEdges = new Set<string>();

      // For depths 1-5, process each group
      for (let d = 1; d <= 5; d++) {
        const nums = DEPTH_MATCHES[d];
        for (let g = 0; g < nums.length; g++) {
          const m = matchByNum.get(nums[g]);
          if (!m) continue;

          const isLive = m.status === "LIVE";

          if (m.winnerId && (m.teamAId || m.teamBId)) {
            const winnerIsA = m.winnerId === m.teamAId;
            const winnerChildGroup = winnerIsA ? g * 2 : g * 2 + 1;
            activeEdges.add(`${d - 1}:${winnerChildGroup}`);
            if (isLive) liveEdges.add(`${d - 1}:${winnerChildGroup}`);
          } else if (isLive) {
            // Both children edges glow teal when live
            liveEdges.add(`${d - 1}:${g * 2}`);
            liveEdges.add(`${d - 1}:${g * 2 + 1}`);
          }
        }
      }

      // For outer positions: track which teams won/lost R32
      const activePositions = new Set<number>(); // won their R32 match
      const eliminatedPositions = new Set<number>(); // lost their R32 match
      const livePositions = new Set<number>(); // R32 match is live

      for (let i = 0; i < 32; i++) {
        const [matchNum, slot] = OUTER_POSITIONS[i];
        const m = matchByNum.get(matchNum);
        if (!m) continue;

        if (m.status === "LIVE") {
          livePositions.add(i);
        } else if (m.winnerId) {
          const teamId = slot === "home" ? m.teamAId : m.teamBId;
          if (teamId && m.winnerId === teamId) {
            activePositions.add(i);
          } else if (m.winnerId) {
            eliminatedPositions.add(i);
          }
        }
      }

      // Champion from final
      const finalMatch = matchByNum.get(104);
      let champion: MatchTeam | null = null;
      if (finalMatch?.winnerId) {
        if (finalMatch.winnerId === finalMatch.teamAId) champion = finalMatch.teamA;
        else if (finalMatch.winnerId === finalMatch.teamBId) champion = finalMatch.teamB;
      }

      return { matchByNum, activeEdges, activePositions, eliminatedPositions, liveEdges, livePositions, champion };
    }, [matches]);

  // Build SVG lines
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number; active: boolean; live: boolean }> = [];

  // Outer team → R32 node (depth 0 → 1)
  for (let i = 0; i < 32; i++) {
    const r32Group = Math.floor(i / 2);
    const edgeKey = `0:${i}`;
    const isActive = activeEdges.has(edgeKey);
    const isLive = liveEdges.has(edgeKey) || livePositions.has(i);

    const teamAng = teamAngle(i);
    const nodeAng = nodeAngle(1, r32Group);
    const [tx, ty] = polar(CX, CY, RADII[0], teamAng);
    const [nx, ny] = polar(CX, CY, RADII[1], nodeAng);
    lines.push({ x1: tx, y1: ty, x2: nx, y2: ny, active: isActive, live: isLive });
  }

  // R32 → R16 (depth 1 → 2)
  for (let g = 0; g < 16; g++) {
    const r16Group = Math.floor(g / 2);
    const edgeKey = `1:${g}`;
    const isActive = activeEdges.has(edgeKey);
    const isLive = liveEdges.has(edgeKey);

    const fromAng = nodeAngle(1, g);
    const toAng = nodeAngle(2, r16Group);
    const [fx, fy] = polar(CX, CY, RADII[1], fromAng);
    const [tx, ty] = polar(CX, CY, RADII[2], toAng);
    lines.push({ x1: fx, y1: fy, x2: tx, y2: ty, active: isActive, live: isLive });
  }

  // R16 → QF (depth 2 → 3)
  for (let k = 0; k < 8; k++) {
    const qfGroup = Math.floor(k / 2);
    const edgeKey = `2:${k}`;
    const isActive = activeEdges.has(edgeKey);
    const isLive = liveEdges.has(edgeKey);

    const fromAng = nodeAngle(2, k);
    const toAng = nodeAngle(3, qfGroup);
    const [fx, fy] = polar(CX, CY, RADII[2], fromAng);
    const [tx, ty] = polar(CX, CY, RADII[3], toAng);
    lines.push({ x1: fx, y1: fy, x2: tx, y2: ty, active: isActive, live: isLive });
  }

  // QF → SF (depth 3 → 4)
  for (let l = 0; l < 4; l++) {
    const sfGroup = Math.floor(l / 2);
    const edgeKey = `3:${l}`;
    const isActive = activeEdges.has(edgeKey);
    const isLive = liveEdges.has(edgeKey);

    const fromAng = nodeAngle(3, l);
    const toAng = nodeAngle(4, sfGroup);
    const [fx, fy] = polar(CX, CY, RADII[3], fromAng);
    const [tx, ty] = polar(CX, CY, RADII[4], toAng);
    lines.push({ x1: fx, y1: fy, x2: tx, y2: ty, active: isActive, live: isLive });
  }

  // SF → center (depth 4 → 5)
  for (let m2 = 0; m2 < 2; m2++) {
    const edgeKey = `4:${m2}`;
    const isActive = activeEdges.has(edgeKey);
    const isLive = liveEdges.has(edgeKey);

    const fromAng = nodeAngle(4, m2);
    const [fx, fy] = polar(CX, CY, RADII[4], fromAng);
    lines.push({ x1: fx, y1: fy, x2: CX, y2: CY, active: isActive, live: isLive });
  }

  return (
    <div style={{ width: "100%", maxWidth: 700, margin: "0 auto" }}>
      <svg
        viewBox="0 0 700 700"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "auto", display: "block" }}
        aria-label="World Cup 2026 bracket visualization"
      >
        {/* Background */}
        <circle cx={CX} cy={CY} r={320} fill="#0a0a12" />

        {/* Subtle ring guides */}
        {RADII.map((r, idx) => (
          <circle key={idx} cx={CX} cy={CY} r={r} fill="none" stroke="#1a1a28" strokeWidth={1} />
        ))}

        {/* Lines — base layer (non-active) */}
        {lines.map((l, i) =>
          !l.active && !l.live ? (
            <line
              key={`line-base-${i}`}
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="#252538"
              strokeWidth={1}
              strokeLinecap="round"
            />
          ) : null
        )}

        {/* Lines — active (winner path) */}
        {lines.map((l, i) =>
          l.active && !l.live ? (
            <line
              key={`line-active-${i}`}
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="#9685E4"
              strokeWidth={2}
              strokeLinecap="round"
            />
          ) : null
        )}

        {/* Lines — live (teal) */}
        {lines.map((l, i) =>
          l.live ? (
            <line
              key={`line-live-${i}`}
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke="#32BEBF"
              strokeWidth={2}
              strokeLinecap="round"
            />
          ) : null
        )}

        {/* Bracket nodes at intermediate radii (depths 1-4) */}
        {[1, 2, 3, 4].map((d) => {
          const groupCount = 32 / Math.pow(2, d);
          const r = RADII[d];
          const nodeR = 1.5 + d * 0.6; // grows inward
          return Array.from({ length: groupCount }, (_, g) => {
            const ang = nodeAngle(d, g);
            const [nx, ny] = polar(CX, CY, r, ang);
            const edgeKeyA = `${d - 1}:${g * 2}`;
            const edgeKeyB = `${d - 1}:${g * 2 + 1}`;
            const isLive = liveEdges.has(edgeKeyA) || liveEdges.has(edgeKeyB);
            const isActive = activeEdges.has(edgeKeyA) || activeEdges.has(edgeKeyB);
            return (
              <circle
                key={`node-${d}-${g}`}
                cx={nx}
                cy={ny}
                r={nodeR}
                fill={isLive ? "#32BEBF" : isActive ? "#9685E4" : "#252538"}
              />
            );
          });
        })}

        {/* Team badges at outer ring */}
        {OUTER_POSITIONS.map(([matchNum, slot], i) => {
          const m = matchByNum.get(matchNum);
          const team = slot === "home" ? m?.teamA : m?.teamB;
          const label = slot === "home"
            ? (m?.teamA?.name ?? m?.teamALabel ?? "TBD")
            : (m?.teamB?.name ?? m?.teamBLabel ?? "TBD");
          const flag = team?.flagEmoji ?? "🏳";

          const isEliminated = eliminatedPositions.has(i);
          const isActive = activePositions.has(i);
          const isLive = livePositions.has(i);

          const ang = teamAngle(i);
          const [bx, by] = polar(CX, CY, RADII[0], ang);

          const badgeStroke = isLive ? "#32BEBF" : isActive ? "#9685E4" : "#2a2a3e";
          const opacity = isEliminated ? 0.3 : 1;

          return (
            <g key={`team-${i}`} opacity={opacity}>
              <title>{label}</title>
              <circle
                cx={bx}
                cy={by}
                r={14}
                fill="#141420"
                stroke={badgeStroke}
                strokeWidth={isActive || isLive ? 1.5 : 1}
              />
              <text
                x={bx}
                y={by}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={13}
                style={{ fontFamily: EMOJI_FONT, userSelect: "none" }}
              >
                {flag}
              </text>
            </g>
          );
        })}

        {/* Center trophy or champion */}
        {champion ? (
          <g>
            <circle cx={CX} cy={CY} r={33} fill="#1a1a28" stroke="#9685E4" strokeWidth={1.5} />
            <title>{champion.name}</title>
            <text
              x={CX}
              y={CY}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={26}
              style={{ fontFamily: EMOJI_FONT, userSelect: "none" }}
            >
              {champion.flagEmoji}
            </text>
          </g>
        ) : (
          <g>
            <circle cx={CX} cy={CY} r={33} fill="#141420" stroke="#2a2a3e" strokeWidth={1} />
            <title>World Cup Trophy</title>
            <text
              x={CX}
              y={CY}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={26}
              style={{ fontFamily: EMOJI_FONT, userSelect: "none" }}
            >
              🏆
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
