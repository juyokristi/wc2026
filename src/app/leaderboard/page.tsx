import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { LeaderboardScroller } from "@/components/leaderboard-scroller";
import { LeaderboardView, type UserStats, type ChartSeries, type ChartPoint } from "@/components/leaderboard-view";

export const revalidate = 60;

export default async function LeaderboardPage() {
  const session = await auth();

  const [allPredictions, winnerPredictions, allUsers] = await Promise.all([
    prisma.prediction.findMany({
      where: { pointsEarned: { not: null } },
      include: {
        user: { select: { id: true, name: true, displayName: true, image: true } },
        match: { select: { stage: true, kickoff: true } },
      },
    }),
    prisma.winnerPrediction.findMany({
      include: { team: { select: { name: true, flagEmoji: true } } },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, displayName: true, image: true },
    }),
  ]);

  const winnerByUser = new Map(winnerPredictions.map((wp) => [wp.userId, wp]));
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  // Compute UserStats per user
  const statsMap = new Map<string, UserStats>();

  for (const p of allPredictions) {
    const uid = p.user.id;
    if (!statsMap.has(uid)) {
      const u = userMap.get(uid) ?? p.user;
      statsMap.set(uid, {
        userId: uid,
        name: u.displayName ?? u.name ?? "Unknown",
        image: u.image ?? null,
        totalPts: 0,
        scoredCount: 0,
        avgPts: 0,
        bestDayPts: 0,
        last5Avg: 0,
        exactCount: 0,
        exactPct: 0,
        groupPts: 0,
        knockoutPts: 0,
      });
    }
    const s = statsMap.get(uid)!;
    const pts = p.pointsEarned!;
    s.scoredCount++;
    s.totalPts += pts;
    if (pts === 5) s.exactCount++;
    if (p.match.stage === "GROUP") s.groupPts += pts;
    else s.knockoutPts += pts;
  }

  // Add winner prediction points to totalPts
  for (const [uid, wp] of winnerByUser) {
    if (!statsMap.has(uid)) {
      const u = userMap.get(uid);
      if (!u) continue;
      statsMap.set(uid, {
        userId: uid,
        name: u.displayName ?? u.name ?? "Unknown",
        image: u.image ?? null,
        totalPts: 0,
        scoredCount: 0,
        avgPts: 0,
        bestDayPts: 0,
        last5Avg: 0,
        exactCount: 0,
        exactPct: 0,
        groupPts: 0,
        knockoutPts: 0,
      });
    }
    const s = statsMap.get(uid)!;
    s.totalPts += wp.pointsEarned ?? 0;
    s.winnerPick = {
      teamName: wp.team.name,
      flag: wp.team.flagEmoji,
      potentialPts: wp.potentialPoints,
      pointsEarned: wp.pointsEarned,
    };
  }

  // Compute derived metrics
  for (const [uid, s] of statsMap) {
    s.avgPts = s.scoredCount > 0 ? s.totalPts / s.scoredCount : 0;
    s.exactPct = s.scoredCount > 0 ? (s.exactCount / s.scoredCount) * 100 : 0;

    // Best day: group predictions by day, find max day total
    const dayTotals = new Map<string, number>();
    for (const p of allPredictions) {
      if (p.user.id !== uid || p.pointsEarned === null) continue;
      const day = new Date(p.match.kickoff).toISOString().split("T")[0];
      dayTotals.set(day, (dayTotals.get(day) ?? 0) + p.pointsEarned);
    }
    s.bestDayPts = dayTotals.size > 0 ? Math.max(...dayTotals.values()) : 0;

    // Last 5: most recent 5 scored predictions by kickoff
    const userPreds = allPredictions
      .filter((p) => p.user.id === uid && p.pointsEarned !== null)
      .sort((a, b) => new Date(b.match.kickoff).getTime() - new Date(a.match.kickoff).getTime())
      .slice(0, 5);
    s.last5Avg =
      userPreds.length > 0
        ? userPreds.reduce((sum, p) => sum + p.pointsEarned!, 0) / userPreds.length
        : 0;
  }

  const stats = [...statsMap.values()].sort((a, b) => b.totalPts - a.totalPts);

  // Chart: cumulative points per user per match day
  const allDays = [...new Set(
    allPredictions.map((p) => p.match.kickoff.toISOString().split("T")[0])
  )].sort();

  const chartSeries: ChartSeries[] = stats
    .filter((s) => s.totalPts > 0)
    .map((s) => {
      const dayMap = new Map<string, number>();
      for (const p of allPredictions) {
        if (p.user.id !== s.userId || p.pointsEarned === null) continue;
        const day = p.match.kickoff.toISOString().split("T")[0];
        dayMap.set(day, (dayMap.get(day) ?? 0) + p.pointsEarned);
      }
      let cum = 0;
      const points: ChartPoint[] = [
        { day: "", cum: 0 }, // synthetic start at 0
        ...allDays.map((day) => {
          cum += dayMap.get(day) ?? 0;
          return { day, cum };
        }),
      ];
      return { userId: s.userId, name: s.name, total: s.totalPts, points };
    });

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <LeaderboardScroller />

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[2px] mb-2" style={{ color: "#9685E4" }}>
          Rankings
        </p>
        <h1 className="text-3xl font-bold" style={{ letterSpacing: "-0.5px", color: "var(--foreground)" }}>
          Leaderboard
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          Updated after each match is scored.
        </p>
      </div>

      {/* Scoring rules */}
      <div
        className="rounded-2xl p-5 mb-6 space-y-2"
        style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
      >
        <p className="text-xs font-bold uppercase tracking-[2px] mb-3" style={{ color: "#9685E4" }}>
          How points work
        </p>
        {[
          { label: "Exact score", pts: "5 pts ⭐" },
          { label: "Correct result + same goal margin", pts: "4 pts" },
          { label: "Correct result only", pts: "3 pts" },
          { label: "Wrong result", pts: "0 pts" },
          { label: "Tournament winner pick", pts: "days until Final" },
        ].map(({ label, pts }, i, arr) => (
          <div key={label}>
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--foreground)" }}>{label}</span>
              <span className="font-semibold" style={{ color: "#9685E4" }}>{pts}</span>
            </div>
            {i < arr.length - 1 && <div className="h-px mt-2" style={{ backgroundColor: "var(--border)" }} />}
          </div>
        ))}
      </div>

      <LeaderboardView
        stats={stats}
        currentUserId={session?.user?.id ?? null}
        chartSeries={chartSeries}
      />
    </div>
  );
}
