import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";

function PointsBadge({ pts }: { pts: number | null }) {
  if (pts === null) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>
        Pending
      </span>
    );
  }
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
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(254,118,55,0.1)", color: "#FE7637" }}>
      0 pts
    </span>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, displayName: true, image: true, email: true },
  });

  const [predictions, allRanked, myWinnerPick] = await Promise.all([
    prisma.prediction.findMany({
      where: { userId: session.user.id },
      include: {
        match: {
          include: {
            teamA: { select: { name: true, flagEmoji: true, code: true } },
            teamB: { select: { name: true, flagEmoji: true, code: true } },
          },
        },
      },
      orderBy: { match: { kickoff: "asc" } },
    }),
    prisma.prediction.groupBy({
      by: ["userId"],
      _sum: { pointsEarned: true },
      where: { pointsEarned: { not: null } },
      orderBy: { _sum: { pointsEarned: "desc" } },
    }),
    prisma.winnerPrediction.findUnique({
      where: { userId: session.user.id },
      include: { team: { select: { name: true, flagEmoji: true, code: true } } },
    }),
  ]);
  const myRankIdx = allRanked.findIndex((r) => r.userId === session.user.id);
  const myRank = myRankIdx >= 0 ? myRankIdx + 1 : null;
  const totalPlayers = allRanked.length;

  const winnerPoints = myWinnerPick?.pointsEarned ?? 0;
  const totalPoints = predictions.reduce((sum, p) => sum + (p.pointsEarned ?? 0), 0) + winnerPoints;

  const fieldTotals = allRanked.map((r) => r._sum.pointsEarned ?? 0);
  const fieldAvg = fieldTotals.length > 0
    ? Math.round(fieldTotals.reduce((a, b) => a + b, 0) / fieldTotals.length)
    : 0;
  const betterThan = fieldTotals.filter((t) => t < totalPoints).length;
  const topPct = fieldTotals.length > 1
    ? Math.round((betterThan / fieldTotals.length) * 100)
    : fieldTotals.length === 1 ? 100 : null;
  const scored = predictions.filter((p) => p.pointsEarned !== null).length;
  const exact = predictions.filter((p) => p.pointsEarned === 5).length;
  const correct = predictions.filter((p) => (p.pointsEarned ?? 0) >= 3).length;
  const accuracy = scored > 0 ? Math.round((correct / scored) * 100) : 0;

  // Best match (highest points earned)
  const bestMatch = predictions.reduce<(typeof predictions)[0] | undefined>(
    (best, p) => ((p.pointsEarned ?? 0) > (best?.pointsEarned ?? 0) ? p : best),
    undefined
  );

  // Current streak: consecutive correct results (pts >= 3) from most recent scored match
  const scoredByDate = predictions
    .filter((p) => p.pointsEarned !== null)
    .sort(
      (a, b) =>
        new Date(b.match.kickoff).getTime() - new Date(a.match.kickoff).getTime()
    );
  let streak = 0;
  for (const p of scoredByDate) {
    if ((p.pointsEarned ?? 0) >= 3) streak++;
    else break;
  }

  // Points per matchday chart data
  const dayMap = new Map<string, { label: string; pts: number }>();
  for (const p of predictions) {
    if (p.pointsEarned === null) continue;
    const date = new Date(p.match.kickoff);
    const key = date.toISOString().split("T")[0];
    const label = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const existing = dayMap.get(key);
    if (existing) existing.pts += p.pointsEarned;
    else dayMap.set(key, { label, pts: p.pointsEarned });
  }
  const chartData = [...dayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => v);
  const maxPts = Math.max(...chartData.map((d) => d.pts), 1);

  const displayName = user?.displayName ?? user?.name ?? "Player";

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      {/* Profile header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-12 w-12">
          <AvatarImage src={user?.image ?? undefined} alt={displayName} />
          <AvatarFallback className="font-semibold" style={{ backgroundColor: "rgba(150,133,228,0.12)", color: "#9685E4" }}>
            {displayName[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold" style={{ letterSpacing: "-0.5px", color: "var(--foreground)" }}>
            {displayName}
          </h1>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{user?.email}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Total points", value: totalPoints, accent: true, sub: null },
          { label: "Predictions made", value: predictions.length, accent: false, sub: null },
          { label: "Exact scores", value: exact, accent: false, sub: null },
          { label: "Result accuracy", value: `${accuracy}%`, accent: false, sub: null },
          {
            label: "Current streak",
            value: streak >= 3 ? `${streak} 🔥` : String(streak),
            accent: streak >= 3,
            sub: null,
          },
          {
            label: "Best score",
            value: `${bestMatch?.pointsEarned ?? 0} pts`,
            accent: false,
            sub: bestMatch
              ? `${bestMatch.match.teamA?.code ?? bestMatch.match.teamALabel ?? "TBD"} vs ${bestMatch.match.teamB?.code ?? bestMatch.match.teamBLabel ?? "TBD"}`
              : null,
          },
          {
            label: "Leaderboard rank",
            value: myRank ? `#${myRank}` : "–",
            accent: myRank === 1,
            sub: myRank ? `of ${totalPlayers} player${totalPlayers !== 1 ? "s" : ""}` : "No scored matches yet",
          },
        ].map(({ label, value, accent, sub }) => (
          <div
            key={label}
            className="rounded-2xl p-4"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
          >
            <div
              className="text-2xl font-bold"
              style={{ color: accent ? "#9685E4" : "var(--foreground)", letterSpacing: "-0.3px" }}
            >
              {value}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{label}</div>
            {sub && (
              <div className="text-xs mt-0.5 truncate" style={{ color: "var(--muted-foreground)" }}>
                {sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* You vs the field */}
      {fieldTotals.length > 1 && (
        <div
          className="rounded-2xl p-5"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
        >
          <p className="text-xs font-bold uppercase tracking-[2px] mb-4" style={{ color: "#9685E4" }}>
            You vs the field
          </p>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold" style={{ color: "#9685E4", letterSpacing: "-0.5px" }}>
                {totalPoints}
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>You</div>
            </div>
            <div className="flex-1 space-y-2">
              {/* Bar: your pts vs field max */}
              {(() => {
                const max = Math.max(...fieldTotals, 1);
                return (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-8 text-right shrink-0" style={{ color: "var(--muted-foreground)" }}>You</span>
                      <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ backgroundColor: "var(--muted)" }}>
                        <div className="h-full rounded-full" style={{ width: `${(totalPoints / max) * 100}%`, backgroundColor: "#9685E4" }} />
                      </div>
                      <span className="text-xs w-6 tabular-nums font-semibold" style={{ color: "var(--foreground)" }}>{totalPoints}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-8 text-right shrink-0" style={{ color: "var(--muted-foreground)" }}>Avg</span>
                      <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ backgroundColor: "var(--muted)" }}>
                        <div className="h-full rounded-full" style={{ width: `${(fieldAvg / max) * 100}%`, backgroundColor: "rgba(150,133,228,0.35)" }} />
                      </div>
                      <span className="text-xs w-6 tabular-nums font-semibold" style={{ color: "var(--muted-foreground)" }}>{fieldAvg}</span>
                    </div>
                  </>
                );
              })()}
            </div>
            {topPct !== null && (
              <div className="text-center shrink-0">
                <div className="text-2xl font-bold" style={{ color: topPct >= 50 ? "#32BEBF" : "var(--foreground)", letterSpacing: "-0.5px" }}>
                  Top {100 - topPct}%
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                  {totalPoints >= fieldAvg ? `+${totalPoints - fieldAvg} vs avg` : `${totalPoints - fieldAvg} vs avg`}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Points by matchday chart */}
      {chartData.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Points by matchday
          </h2>
          <div
            className="rounded-2xl p-5 space-y-2.5"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
          >
            {chartData.map(({ label, pts }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs w-14 text-right shrink-0 tabular-nums" style={{ color: "var(--muted-foreground)" }}>
                  {label}
                </span>
                <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--muted)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(pts / maxPts) * 100}%`, backgroundColor: "#9685E4", opacity: 0.8 }}
                  />
                </div>
                <span className="text-xs w-8 shrink-0 font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>
                  {pts}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Winner pick */}
      {myWinnerPick && (
        <div
          className="rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[2px] mb-1" style={{ color: "#9685E4" }}>
              Tournament Winner Pick
            </p>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{myWinnerPick.team.flagEmoji}</span>
              <span className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
                {myWinnerPick.team.name}
              </span>
            </div>
          </div>
          <div className="text-right">
            {myWinnerPick.pointsEarned !== null ? (
              <>
                <p className="text-2xl font-bold" style={{ color: myWinnerPick.pointsEarned > 0 ? "#32BEBF" : "var(--muted-foreground)", letterSpacing: "-0.5px" }}>
                  {myWinnerPick.pointsEarned} pts
                </p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {myWinnerPick.pointsEarned > 0 ? "Correct!" : "Incorrect"}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold" style={{ color: "#9685E4", letterSpacing: "-0.5px" }}>
                  {myWinnerPick.potentialPoints} pts
                </p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  Potential · Final pending
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Prediction history */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>Your predictions</h2>
          {predictions.length === 0 && (
            <Link href="/predict" className="text-sm font-medium" style={{ color: "#9685E4" }}>
              Make predictions →
            </Link>
          )}
        </div>

        {predictions.length === 0 ? (
          <div
            className="rounded-2xl py-12 text-center"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
          >
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              No predictions yet.{" "}
              <Link href="/predict" className="font-medium" style={{ color: "#9685E4" }}>
                Head to Predict
              </Link>{" "}
              to get started.
            </p>
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
          >
            {predictions.map((p, i) => {
              const teamA = p.match.teamA?.name ?? p.match.teamALabel ?? "TBD";
              const teamB = p.match.teamB?.name ?? p.match.teamBLabel ?? "TBD";
              const flagA = p.match.teamA?.flagEmoji ?? "🏳";
              const flagB = p.match.teamB?.flagEmoji ?? "🏳";
              const finished = p.match.status === "FINISHED";
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                  style={{ borderBottom: i < predictions.length - 1 ? "1px solid var(--border)" : "none" }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-base">{flagA}</span>
                    <span className="text-sm truncate" style={{ color: "var(--foreground)" }}>{teamA}</span>
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>vs</span>
                    <span className="text-sm truncate" style={{ color: "var(--foreground)" }}>{teamB}</span>
                    <span className="text-base">{flagB}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm tabular-nums" style={{ color: "var(--mid-foreground)" }}>
                      {p.predictedA}–{p.predictedB}
                    </span>
                    {finished && p.match.scoreA !== null && (
                      <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                        ({p.match.scoreAFull ?? p.match.scoreA}–{p.match.scoreBFull ?? p.match.scoreB}{p.match.overtime ? ` ${p.match.overtime}` : ""})
                      </span>
                    )}
                    <PointsBadge pts={p.pointsEarned} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
