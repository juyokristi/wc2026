import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { LeaderboardScroller } from "@/components/leaderboard-scroller";

export const revalidate = 60;

export default async function LeaderboardPage() {
  const session = await auth();

  const grouped = await prisma.prediction.groupBy({
    by: ["userId"],
    _sum: { pointsEarned: true },
    _count: { id: true },
    where: { pointsEarned: { not: null } },
    orderBy: { _sum: { pointsEarned: "desc" } },
    take: 100,
  });

  const userIds = grouped.map((g) => g.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true, name: true, image: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const leaderboard = grouped.map((g, index) => ({
    rank: index + 1,
    user: userMap[g.userId],
    totalPoints: g._sum.pointsEarned ?? 0,
    predictionsScored: g._count.id,
  }));

  function rankDisplay(rank: number) {
    if (rank === 1) return { label: "1", medal: "🥇" };
    if (rank === 2) return { label: "2", medal: "🥈" };
    if (rank === 3) return { label: "3", medal: "🥉" };
    return { label: String(rank), medal: null };
  }

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

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
      >
        {leaderboard.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              No scores yet
            </p>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Predictions are scored after each match finishes. Check back soon.
            </p>
          </div>
        ) : (
          leaderboard.map((entry, i) => {
            const isMe = entry.user?.id === session?.user?.id;
            const displayName = entry.user?.displayName ?? entry.user?.name ?? "Unknown";
            const { label, medal } = rankDisplay(entry.rank);
            const rowInner = (
              <>
                {/* Rank */}
                <div className="w-8 shrink-0 text-center">
                  {medal ? (
                    <span className="text-lg">{medal}</span>
                  ) : (
                    <span className="text-sm font-semibold" style={{ color: "var(--muted-foreground)" }}>
                      {label}
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={entry.user?.image ?? undefined} alt={displayName} />
                  <AvatarFallback className="text-xs font-medium" style={{ backgroundColor: "var(--muted)", color: "var(--mid-foreground)" }}>
                    {displayName[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                    {displayName}
                    {isMe && (
                      <span className="ml-2 text-xs font-semibold" style={{ color: "#9685E4" }}>
                        you
                      </span>
                    )}
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {entry.predictionsScored} match{entry.predictionsScored !== 1 ? "es" : ""} scored
                  </p>
                </div>

                {/* Points */}
                <div
                  className="shrink-0 text-right text-base font-bold"
                  style={{ color: isMe ? "#9685E4" : "var(--foreground)" }}
                >
                  {entry.totalPoints}
                  <span className="text-xs font-normal ml-1" style={{ color: "var(--muted-foreground)" }}>pts</span>
                </div>
              </>
            );

            const rowStyle = {
              borderBottom: i < leaderboard.length - 1 ? "1px solid var(--border)" : "none",
              backgroundColor: isMe ? "rgba(150, 133, 228, 0.06)" : "transparent",
            };

            if (!isMe && entry.user?.id) {
              return (
                <Link
                  key={entry.user.id}
                  href={`/players/${entry.user.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors"
                  style={rowStyle}
                >
                  {rowInner}
                </Link>
              );
            }

            return (
              <div
                id="me-row"
                key={entry.user?.id}
                className="flex items-center gap-4 px-5 py-4"
                style={rowStyle}
              >
                {rowInner}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
