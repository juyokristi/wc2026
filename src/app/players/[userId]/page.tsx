import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function PointsBadge({ pts }: { pts: number | null }) {
  if (pts === null) {
    return (
      <span
        className="text-xs px-2 py-0.5 rounded-full font-medium"
        style={{
          backgroundColor: "var(--muted)",
          color: "var(--muted-foreground)",
        }}
      >
        Pending
      </span>
    );
  }
  if (pts === 5)
    return (
      <span
        className="text-xs px-2 py-0.5 rounded-full font-semibold"
        style={{ backgroundColor: "rgba(150,133,228,0.12)", color: "#9685E4" }}
      >
        5 pts ⭐
      </span>
    );
  if (pts === 4)
    return (
      <span
        className="text-xs px-2 py-0.5 rounded-full font-semibold"
        style={{ backgroundColor: "rgba(71,126,227,0.12)", color: "#477EE3" }}
      >
        4 pts
      </span>
    );
  if (pts === 3)
    return (
      <span
        className="text-xs px-2 py-0.5 rounded-full font-semibold"
        style={{ backgroundColor: "rgba(50,190,191,0.12)", color: "#32BEBF" }}
      >
        3 pts
      </span>
    );
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-semibold"
      style={{ backgroundColor: "rgba(254,118,55,0.1)", color: "#FE7637" }}
    >
      0 pts
    </span>
  );
}

interface Props {
  params: Promise<{ userId: string }>;
}

export default async function PlayerPage({ params }: Props) {
  const { userId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  // If viewing own profile, redirect to dashboard
  if (userId === session.user.id) redirect("/dashboard");

  const [targetUser, myPredictions, theirPredictions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, displayName: true, image: true },
    }),
    prisma.prediction.findMany({
      where: { userId: session.user.id },
      select: {
        matchId: true,
        predictedA: true,
        predictedB: true,
        pointsEarned: true,
      },
    }),
    prisma.prediction.findMany({
      where: { userId },
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
  ]);

  if (!targetUser) redirect("/leaderboard");

  // Build map of my predictions by matchId
  const myPredMap = Object.fromEntries(
    myPredictions.map((p) => [p.matchId, p])
  );

  const displayName = targetUser.displayName ?? targetUser.name ?? "Player";

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      {/* Profile header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-12 w-12">
          <AvatarImage src={targetUser.image ?? undefined} alt={displayName} />
          <AvatarFallback
            className="font-semibold"
            style={{
              backgroundColor: "rgba(150,133,228,0.12)",
              color: "#9685E4",
            }}
          >
            {displayName[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ letterSpacing: "-0.5px", color: "var(--foreground)" }}
          >
            {displayName}
          </h1>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Head-to-head comparison
          </p>
        </div>
      </div>

      {/* Predictions comparison table */}
      <div>
        <h2
          className="text-lg font-semibold mb-4"
          style={{ color: "var(--foreground)" }}
        >
          Predictions
        </h2>

        {theirPredictions.length === 0 ? (
          <div
            className="rounded-2xl py-12 text-center"
            style={{
              border: "1px solid var(--border)",
              backgroundColor: "var(--card)",
            }}
          >
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              {displayName} has no predictions yet.
            </p>
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              border: "1px solid var(--border)",
              backgroundColor: "var(--card)",
            }}
          >
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Match</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider w-20" style={{ color: "var(--muted-foreground)" }}>Theirs</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider w-20" style={{ color: "var(--muted-foreground)" }}>Yours</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider w-20" style={{ color: "var(--muted-foreground)" }}>Result</th>
                  <th className="px-5 py-2 text-right text-xs font-semibold uppercase tracking-wider w-24" style={{ color: "var(--muted-foreground)" }}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {theirPredictions.map((p, i) => {
                  const teamA = p.match.teamA?.name ?? p.match.teamALabel ?? "TBD";
                  const teamB = p.match.teamB?.name ?? p.match.teamBLabel ?? "TBD";
                  const flagA = p.match.teamA?.flagEmoji ?? "🏳";
                  const flagB = p.match.teamB?.flagEmoji ?? "🏳";
                  const finished = p.match.status === "FINISHED";
                  const myPred = myPredMap[p.matchId];

                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom:
                          i < theirPredictions.length - 1
                            ? "1px solid var(--border)"
                            : "none",
                      }}
                    >
                      {/* Teams */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm">{flagA}</span>
                          <span className="text-sm truncate" style={{ color: "var(--foreground)" }}>{teamA}</span>
                          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>vs</span>
                          <span className="text-sm truncate" style={{ color: "var(--foreground)" }}>{teamB}</span>
                          <span className="text-sm">{flagB}</span>
                        </div>
                      </td>

                      {/* Their prediction */}
                      <td className="px-3 py-3 text-right text-sm tabular-nums font-medium" style={{ color: "#9685E4" }}>
                        {p.predictedA}–{p.predictedB}
                      </td>

                      {/* My prediction */}
                      <td className="px-3 py-3 text-right text-sm tabular-nums" style={{ color: "var(--muted-foreground)" }}>
                        {myPred ? `${myPred.predictedA}–${myPred.predictedB}` : "–"}
                      </td>

                      {/* Actual result */}
                      <td className="px-3 py-3 text-right text-sm tabular-nums font-medium" style={{ color: "var(--foreground)" }}>
                        {finished && p.match.scoreA !== null ? `${p.match.scoreA}–${p.match.scoreB}` : "–"}
                      </td>

                      {/* Points */}
                      <td className="px-5 py-3 text-right">
                        <PointsBadge pts={p.pointsEarned} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
