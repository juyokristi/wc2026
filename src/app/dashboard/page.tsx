import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function pointsBadge(pts: number | null) {
  if (pts === null) return <Badge variant="secondary">Pending</Badge>;
  if (pts === 5) return <Badge className="bg-green-500 text-white">5 pts ⭐</Badge>;
  if (pts === 4) return <Badge className="bg-blue-500 text-white">4 pts 🔥</Badge>;
  if (pts === 3) return <Badge className="bg-yellow-500 text-white">3 pts ✅</Badge>;
  return <Badge variant="destructive">0 pts</Badge>;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, displayName: true, image: true, email: true },
  });

  const predictions = await prisma.prediction.findMany({
    where: { userId: session.user.id },
    include: {
      match: {
        include: {
          teamA: { select: { name: true, flagEmoji: true } },
          teamB: { select: { name: true, flagEmoji: true } },
        },
      },
    },
    orderBy: { match: { kickoff: "asc" } },
  });

  const totalPoints = predictions.reduce((sum, p) => sum + (p.pointsEarned ?? 0), 0);
  const scored = predictions.filter((p) => p.pointsEarned !== null).length;
  const exact = predictions.filter((p) => p.pointsEarned === 5).length;
  const correct = predictions.filter((p) => (p.pointsEarned ?? 0) >= 3).length;

  const displayName = user?.displayName ?? user?.name ?? "Player";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Profile header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14">
          <AvatarImage src={user?.image ?? undefined} alt={displayName} />
          <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{displayName}</h1>
          <p className="text-muted-foreground text-sm">{user?.email}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-primary">{totalPoints}</div>
            <div className="text-xs text-muted-foreground mt-1">Total Points</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{predictions.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Predictions Made</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{exact}</div>
            <div className="text-xs text-muted-foreground mt-1">Exact Scores ⭐</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{scored > 0 ? Math.round((correct / scored) * 100) : 0}%</div>
            <div className="text-xs text-muted-foreground mt-1">Result Accuracy</div>
          </CardContent>
        </Card>
      </div>

      {/* Prediction history */}
      <Card>
        <CardHeader>
          <CardTitle>Your Predictions</CardTitle>
        </CardHeader>
        <CardContent>
          {predictions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No predictions yet. Head to the <a href="/predict" className="underline">Predict</a> page to get started.</p>
          ) : (
            <div className="space-y-2">
              {predictions.map((p) => {
                const teamA = p.match.teamA?.name ?? p.match.teamALabel ?? "TBD";
                const teamB = p.match.teamB?.name ?? p.match.teamBLabel ?? "TBD";
                const flagA = p.match.teamA?.flagEmoji ?? "🏳";
                const flagB = p.match.teamB?.flagEmoji ?? "🏳";
                const finished = p.match.status === "FINISHED";
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span>{flagA}</span>
                      <span className="text-sm truncate">{teamA}</span>
                      <span className="text-muted-foreground text-sm">vs</span>
                      <span className="text-sm truncate">{teamB}</span>
                      <span>{flagB}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm text-muted-foreground">
                        {p.predictedA}–{p.predictedB}
                      </span>
                      {finished && p.match.scoreA !== null && (
                        <span className="text-sm font-medium">
                          ({p.match.scoreA}–{p.match.scoreB})
                        </span>
                      )}
                      {pointsBadge(p.pointsEarned)}
                    </div>
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
