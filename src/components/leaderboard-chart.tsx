"use client";

import { useState } from "react";
import type { ChartSeries } from "@/components/leaderboard-view";

const COLORS = [
  "#9685E4", "#32BEBF", "#FE7637", "#F59E0B", "#10B981",
  "#F43F5E", "#477EE3", "#a78bfa", "#22d3ee", "#84CC16",
];

const VW = 700, VH = 300;
const ML = 34, MR = 130, MT = 14, MB = 34;
const CW = VW - ML - MR;
const CH = VH - MT - MB;

function fmtDay(iso: string) {
  if (!iso) return "";
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

function yAxisMax(max: number) {
  const step = max <= 40 ? 10 : max <= 80 ? 20 : max <= 150 ? 25 : max <= 300 ? 50 : 100;
  return Math.ceil(max / step) * step || step;
}

function yTicks(axisMax: number): number[] {
  const step = axisMax <= 40 ? 10 : axisMax <= 80 ? 20 : axisMax <= 150 ? 25 : axisMax <= 300 ? 50 : 100;
  const ticks = [];
  for (let v = 0; v <= axisMax; v += step) ticks.push(v);
  return ticks;
}

export function LeaderboardChart({
  series,
  currentUserId,
}: {
  series: ChartSeries[];
  currentUserId: string | null;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!series.length || series[0].points.length < 2) {
    return (
      <p className="text-sm py-10 text-center" style={{ color: "var(--muted-foreground)" }}>
        Not enough scored matches yet.
      </p>
    );
  }

  const n = series[0].points.length; // includes synthetic start point
  const days = series[0].points.map((p) => p.day);
  const realMax = Math.max(...series.map((s) => s.total), 1);
  const axisMax = yAxisMax(realMax);
  const ticks = yTicks(axisMax);

  function xOf(i: number) {
    return ML + ((n <= 1 ? 0.5 : i / (n - 1)) * CW);
  }
  function yOf(pts: number) {
    return MT + CH - (pts / axisMax) * CH;
  }

  // Right-side label positions with de-collision (push down)
  const rawLabels = series
    .map((s, si) => ({ si, y: yOf(s.total), color: COLORS[si % COLORS.length], name: s.name.split(" ")[0], total: s.total, isMe: s.userId === currentUserId }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < rawLabels.length; i++) {
    if (rawLabels[i].y < rawLabels[i - 1].y + 16) rawLabels[i].y = rawLabels[i - 1].y + 16;
  }
  const labelY = new Map(rawLabels.map((l) => [l.si, l.y]));

  // X-axis interval
  const xInterval = n <= 7 ? 1 : n <= 14 ? 2 : 3;

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      onMouseMove={(e) => {
        const svg = e.currentTarget as SVGSVGElement;
        const rect = svg.getBoundingClientRect();
        const svgX = ((e.clientX - rect.left) / rect.width) * VW;
        const frac = Math.max(0, Math.min(1, (svgX - ML) / CW));
        setHoverIdx(Math.round(frac * (n - 1)));
      }}
      onMouseLeave={() => setHoverIdx(null)}
    >
      {/* Y grid + labels */}
      {ticks.map((v) => (
        <g key={v}>
          <line x1={ML} x2={ML + CW} y1={yOf(v)} y2={yOf(v)} stroke="#1a1a2e" strokeWidth={1} />
          <text x={ML - 6} y={yOf(v) + 4} textAnchor="end" fontSize={9} fill="#3a3a55">
            {v}
          </text>
        </g>
      ))}

      {/* X-axis labels (skip start point at i=0) */}
      {days.map((d, i) => {
        if (!d || (i % xInterval !== 0 && i !== n - 1)) return null;
        return (
          <text key={d} x={xOf(i)} y={VH - MB + 18} textAnchor="middle" fontSize={9} fill="#3a3a55">
            {fmtDay(d)}
          </text>
        );
      })}

      {/* Lines */}
      {series.map((s, si) => {
        const color = COLORS[si % COLORS.length];
        const isMe = s.userId === currentUserId;
        const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(p.cum).toFixed(1)}`).join(" ");
        return (
          <path
            key={s.userId}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={isMe ? 2.5 : 1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={hoverIdx !== null ? 0.2 : 1}
          />
        );
      })}

      {/* Hover overlay */}
      {hoverIdx !== null && (
        <>
          <line
            x1={xOf(hoverIdx)} x2={xOf(hoverIdx)} y1={MT} y2={MT + CH}
            stroke="#9685E4" strokeWidth={1} strokeDasharray="3 2" opacity={0.5}
          />
          {series.map((s, si) => {
            const pt = s.points[hoverIdx];
            if (!pt) return null;
            return (
              <circle key={s.userId}
                cx={xOf(hoverIdx)} cy={yOf(pt.cum)}
                r={4} fill={COLORS[si % COLORS.length]}
              />
            );
          })}
          {/* Tooltip */}
          {(() => {
            const tx = xOf(hoverIdx);
            const bw = 116, bh = series.length * 14 + 20;
            const bx = tx + bw + 12 > VW - MR + ML ? tx - bw - 10 : tx + 10;
            const by = MT;
            return (
              <g>
                <rect x={bx} y={by} width={bw} height={bh} rx={6} fill="#12121f" opacity={0.95} />
                <text x={bx + 8} y={by + 13} fontSize={10} fill="#9685E4" fontWeight={700}>
                  {fmtDay(days[hoverIdx]) || "Start"}
                </text>
                {series.map((s, si) => (
                  <text key={s.userId} x={bx + 8} y={by + 13 + (si + 1) * 14} fontSize={10} fill={COLORS[si % COLORS.length]}>
                    {s.name.split(" ")[0]} · {s.points[hoverIdx]?.cum ?? 0} pts
                  </text>
                ))}
              </g>
            );
          })()}
        </>
      )}

      {/* Right-side labels */}
      {series.map((s, si) => {
        const color = COLORS[si % COLORS.length];
        const isMe = s.userId === currentUserId;
        const actualY = yOf(s.total);
        const ly = labelY.get(si) ?? actualY;
        const rx = ML + CW;
        return (
          <g key={s.userId}>
            <line x1={rx} y1={actualY} x2={rx + 5} y2={actualY} stroke={color} strokeWidth={1} />
            {Math.abs(ly - actualY) > 3 && (
              <line x1={rx + 5} y1={actualY} x2={rx + 10} y2={ly} stroke={color} strokeWidth={0.8} opacity={0.35} />
            )}
            <text x={rx + 12} y={ly + 4} fontSize={isMe ? 11 : 10} fontWeight={isMe ? 700 : 500} fill={color}>
              {s.name.split(" ")[0]} {s.total}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
