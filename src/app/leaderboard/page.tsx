import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[2px] mb-2" style={{ color: "#9685E4" }}>
          Rankings
        </p>
        <h1 className="text-3xl font-bold" style={{ letterSpacing: "-0.5px", color: "#101418" }}>
          Leaderboard
        </h1>
        <p className="text-sm mt-1" style={{ color: "#8A9199" }}>
          Updated after each match is scored.
        </p>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid #E4E6EA", backgroundColor: "#FFFFFF" }}
      >
        {leaderboard.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm" style={{ color: "#8A9199" }}>
              No scores yet — predictions will be scored after each match.
            </p>
          </div>
        ) : (
          leaderboard.map((entry, i) => {
            const isMe = entry.user?.id === session?.user?.id;
            const displayName = entry.user?.displayName ?? entry.user?.name ?? "Unknown";
            const { label, medal } = rankDisplay(entry.rank);
            return (
              <div
                key={entry.user?.id}
                className="flex items-center gap-4 px-5 py-4"
                style={{
                  borderBottom: i < leaderboard.length - 1 ? "1px solid #E4E6EA" : "none",
                  backgroundColor: isMe ? "rgba(150, 133, 228, 0.06)" : "transparent",
                }}
              >
                {/* Rank */}
                <div className="w-8 shrink-0 text-center">
                  {medal ? (
                    <span className="text-lg">{medal}</span>
                  ) : (
                    <span className="text-sm font-semibold" style={{ color: "#8A9199" }}>
                      {label}
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={entry.user?.image ?? undefined} alt={displayName} />
                  <AvatarFallback className="text-xs font-medium" style={{ backgroundColor: "#F3F4F6", color: "#3A3F47" }}>
                    {displayName[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "#101418" }}>
                    {displayName}
                    {isMe && (
                      <span className="ml-2 text-xs font-semibold" style={{ color: "#9685E4" }}>
                        you
                      </span>
                    )}
                  </p>
                  <p className="text-xs" style={{ color: "#8A9199" }}>
                    {entry.predictionsScored} match{entry.predictionsScored !== 1 ? "es" : ""} scored
                  </p>
                </div>

                {/* Points */}
                <div
                  className="shrink-0 text-right text-base font-bold"
                  style={{ color: isMe ? "#9685E4" : "#101418" }}
                >
                  {entry.totalPoints}
                  <span className="text-xs font-normal ml-1" style={{ color: "#8A9199" }}>pts</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
