"use client";

import { useState, useRef, useEffect } from "react";
import type { ChartSeries } from "@/components/leaderboard-view";

const COLORS = [
  "#9685E4", "#32BEBF", "#FE7637", "#F59E0B", "#10B981",
  "#F43F5E", "#477EE3", "#a78bfa", "#22d3ee", "#84CC16",
];

const VW = 700, VH = 300;
const ML = 36, MR = 134, MT = 14, MB = 34;
const CW = VW - ML - MR;
const CH = VH - MT - MB;

function fmtDay(iso: string) {
  if (!iso) return "";
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

function niceRange(min: number, max: number) {
  if (min === max) return { lo: Math.max(0, min - 10), hi: max + 10, step: 10 };
  const range = max - min;
  const rawStep = range / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(rawStep, 1))));
  const step = Math.ceil(rawStep / mag) * mag || 5;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  return { lo, hi, step };
}

export function LeaderboardChart({
  series,
  currentUserId,
}: {
  series: ChartSeries[];
  currentUserId: string | null;
}) {
  // series[0].points includes synthetic start at index 0
  const totalDays = (series[0]?.points.length ?? 1) - 1;
  const [windowSize, setWindowSize] = useState(Math.min(5, totalDays));
  const [showAll, setShowAll] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Scroll-to-zoom: attach with passive:false so we can preventDefault
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      setWindowSize((prev) =>
        Math.max(2, Math.min(totalDays, prev + (e.deltaY > 0 ? 1 : -1)))
      );
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [totalDays]);

  if (!series.length || totalDays < 1) {
    return (
      <p className="text-sm py-10 text-center" style={{ color: "var(--muted-foreground)" }}>
        Not enough scored matches yet.
      </p>
    );
  }

  const displayed = showAll ? series : series.slice(0, Math.min(5, series.length));

  // Visible slice: last windowSize real days + one context point before
  const fullLen = series[0].points.length;
  const startIdx = Math.max(0, fullLen - windowSize - 1);
  const visiblePts = displayed.map((s) => s.points.slice(startIdx));
  const visibleDays = series[0].points.slice(startIdx).map((p) => p.day);
  const n = visibleDays.length;

  // Y-axis: scale to visible range
  const allCums = visiblePts.flatMap((pts) => pts.map((p) => p.cum));
  const minCum = Math.min(...allCums);
  const maxCum = Math.max(...allCums, minCum + 1);
  const { lo, hi, step } = niceRange(minCum, maxCum);
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);

  function xOf(i: number) {
    return ML + (n <= 1 ? CW / 2 : (i / (n - 1)) * CW);
  }
  function yOf(pts: number) {
    return MT + CH - ((pts - lo) / (hi - lo || 1)) * CH;
  }

  // Right-side labels: position at last visible point, de-collide downward
  const rawLabels = displayed
    .map((s, si) => {
      const lastPt = visiblePts[si]?.[visiblePts[si].length - 1];
      return {
        si,
        cum: lastPt?.cum ?? 0,
        y: yOf(lastPt?.cum ?? 0),
        color: COLORS[si % COLORS.length],
        firstName: s.name.split(" ")[0],
        isMe: s.userId === currentUserId,
      };
    })
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < rawLabels.length; i++) {
    if (rawLabels[i].y < rawLabels[i - 1].y + 16) {
      rawLabels[i].y = rawLabels[i - 1].y + 16;
    }
  }
  const labelY = new Map(rawLabels.map((l) => [l.si, l.y]));

  const xInterval = n <= 6 ? 1 : n <= 12 ? 2 : 3;
  const zoomLabel =
    windowSize >= totalDays
      ? `All ${totalDays} days`
      : `Last ${windowSize} of ${totalDays} days`;

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowAll(false)}
            className="text-xs font-semibold px-2.5 py-1 rounded-full transition-colors"
            style={{
              backgroundColor: !showAll ? "#9685E4" : "var(--muted)",
              color: !showAll ? "#fff" : "var(--muted-foreground)",
            }}
          >
            Top 5
          </button>
          <button
            onClick={() => setShowAll(true)}
            className="text-xs font-semibold px-2.5 py-1 rounded-full transition-colors"
            style={{
              backgroundColor: showAll ? "#9685E4" : "var(--muted)",
              color: showAll ? "#fff" : "var(--muted-foreground)",
            }}
          >
            All
          </button>
        </div>
        <span className="text-xs tabular-nums" style={{ color: "var(--muted-foreground)" }}>
          {zoomLabel} · scroll to zoom
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair" }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const svgX = ((e.clientX - rect.left) / rect.width) * VW;
          const frac = Math.max(0, Math.min(1, (svgX - ML) / CW));
          setHoverIdx(Math.round(frac * (n - 1)));
        }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Y grid */}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={ML} x2={ML + CW} y1={yOf(v)} y2={yOf(v)} stroke="#1a1a2e" strokeWidth={1} />
            <text x={ML - 6} y={yOf(v) + 4} textAnchor="end" fontSize={9} fill="#3a3a55">
              {v}
            </text>
          </g>
        ))}

        {/* X labels */}
        {visibleDays.map((d, i) => {
          if (!d || (i % xInterval !== 0 && i !== n - 1)) return null;
          return (
            <text key={`${d}-${i}`} x={xOf(i)} y={VH - MB + 18} textAnchor="middle" fontSize={9} fill="#3a3a55">
              {fmtDay(d)}
            </text>
          );
        })}

        {/* Lines */}
        {displayed.map((s, si) => {
          const color = COLORS[si % COLORS.length];
          const isMe = s.userId === currentUserId;
          const pts = visiblePts[si];
          if (!pts?.length) return null;
          const d = pts
            .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(p.cum).toFixed(1)}`)
            .join(" ");
          return (
            <path
              key={s.userId}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={isMe ? 2.5 : 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={hoverIdx !== null ? 0.18 : 1}
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
            {displayed.map((s, si) => {
              const pt = visiblePts[si]?.[hoverIdx];
              if (!pt) return null;
              return (
                <circle
                  key={s.userId}
                  cx={xOf(hoverIdx)} cy={yOf(pt.cum)}
                  r={4} fill={COLORS[si % COLORS.length]}
                />
              );
            })}
            {/* Tooltip */}
            {(() => {
              const tx = xOf(hoverIdx);
              const bw = 122, bh = displayed.length * 14 + 22;
              const bx = tx + bw + 14 > VW - MR + ML ? tx - bw - 10 : tx + 10;
              return (
                <g>
                  <rect x={bx} y={MT + 4} width={bw} height={bh} rx={6} fill="#12121f" opacity={0.95} />
                  <text x={bx + 8} y={MT + 16} fontSize={10} fill="#9685E4" fontWeight={700}>
                    {fmtDay(visibleDays[hoverIdx]) || "Start"}
                  </text>
                  {displayed.map((s, si) => {
                    const pt = visiblePts[si]?.[hoverIdx];
                    return (
                      <text key={s.userId} x={bx + 8} y={MT + 16 + (si + 1) * 14} fontSize={10} fill={COLORS[si % COLORS.length]}>
                        {s.name.split(" ")[0]} · {pt?.cum ?? 0} pts
                      </text>
                    );
                  })}
                </g>
              );
            })()}
          </>
        )}

        {/* Right-side labels */}
        {displayed.map((s, si) => {
          const color = COLORS[si % COLORS.length];
          const isMe = s.userId === currentUserId;
          const lastPt = visiblePts[si]?.[visiblePts[si].length - 1];
          if (!lastPt) return null;
          const actualY = yOf(lastPt.cum);
          const ly = labelY.get(si) ?? actualY;
          const rx = ML + CW;
          return (
            <g key={s.userId}>
              <line x1={rx} y1={actualY} x2={rx + 5} y2={actualY} stroke={color} strokeWidth={1} />
              {Math.abs(ly - actualY) > 3 && (
                <line x1={rx + 5} y1={actualY} x2={rx + 10} y2={ly}
                  stroke={color} strokeWidth={0.8} opacity={0.35} />
              )}
              <text x={rx + 12} y={ly + 4} fontSize={isMe ? 11 : 10} fontWeight={isMe ? 700 : 500} fill={color}>
                {s.name.split(" ")[0]} {lastPt.cum}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
