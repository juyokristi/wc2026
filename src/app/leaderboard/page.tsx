import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  function rankBadge(rank: number) {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">🏆 Leaderboard</CardTitle>
          <p className="text-sm text-muted-foreground">Updated after each match is scored</p>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No scores yet — first matches kick off soon!
            </p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry) => {
                const isMe = entry.user?.id === session?.user?.id;
                const displayName = entry.user?.displayName ?? entry.user?.name ?? "Unknown";
                return (
                  <div
                    key={entry.user?.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      isMe ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="w-10 text-center font-bold text-lg shrink-0">
                      {rankBadge(entry.rank)}
                    </span>
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={entry.user?.image ?? undefined} alt={displayName} />
                      <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium truncate block">
                        {displayName}
                        {isMe && <span className="text-xs text-primary ml-2">(you)</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {entry.predictionsScored} matches scored
                      </span>
                    </div>
                    <Badge variant={isMe ? "default" : "secondary"} className="text-base px-3 py-1 shrink-0">
                      {entry.totalPoints} pts
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
