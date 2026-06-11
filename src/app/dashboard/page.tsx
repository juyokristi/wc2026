import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";

function PointsBadge({ pts }: { pts: number | null }) {
  if (pts === null) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#F3F4F6", color: "#8A9199" }}>
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
  const accuracy = scored > 0 ? Math.round((correct / scored) * 100) : 0;

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
          <h1 className="text-2xl font-bold" style={{ letterSpacing: "-0.5px", color: "#101418" }}>
            {displayName}
          </h1>
          <p className="text-sm" style={{ color: "#8A9199" }}>{user?.email}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total points", value: totalPoints, accent: true },
          { label: "Predictions made", value: predictions.length, accent: false },
          { label: "Exact scores", value: exact, accent: false },
          { label: "Result accuracy", value: `${accuracy}%`, accent: false },
        ].map(({ label, value, accent }) => (
          <div
            key={label}
            className="rounded-2xl p-4"
            style={{ border: "1px solid #E4E6EA", backgroundColor: "#FFFFFF" }}
          >
            <div
              className="text-2xl font-bold"
              style={{ color: accent ? "#9685E4" : "#101418", letterSpacing: "-0.3px" }}
            >
              {value}
            </div>
            <div className="text-xs mt-1" style={{ color: "#8A9199" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Prediction history */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: "#101418" }}>Your predictions</h2>
          {predictions.length === 0 && (
            <Link href="/predict" className="text-sm font-medium" style={{ color: "#9685E4" }}>
              Make predictions →
            </Link>
          )}
        </div>

        {predictions.length === 0 ? (
          <div
            className="rounded-2xl py-12 text-center"
            style={{ border: "1px solid #E4E6EA", backgroundColor: "#FFFFFF" }}
          >
            <p className="text-sm" style={{ color: "#8A9199" }}>
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
            style={{ border: "1px solid #E4E6EA", backgroundColor: "#FFFFFF" }}
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
                  style={{ borderBottom: i < predictions.length - 1 ? "1px solid #E4E6EA" : "none" }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-base">{flagA}</span>
                    <span className="text-sm truncate" style={{ color: "#101418" }}>{teamA}</span>
                    <span className="text-xs" style={{ color: "#8A9199" }}>vs</span>
                    <span className="text-sm truncate" style={{ color: "#101418" }}>{teamB}</span>
                    <span className="text-base">{flagB}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm tabular-nums" style={{ color: "#3A3F47" }}>
                      {p.predictedA}–{p.predictedB}
                    </span>
                    {finished && p.match.scoreA !== null && (
                      <span className="text-xs font-medium" style={{ color: "#8A9199" }}>
                        ({p.match.scoreA}–{p.match.scoreB})
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
