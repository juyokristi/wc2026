import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BulkPredictForm } from "@/components/bulk-predict-form";
import Link from "next/link";

export default async function BulkPredictPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const openMatches = await prisma.match.findMany({
    where: {
      status: "SCHEDULED",
      kickoff: { gt: new Date() },
      predictions: { none: { userId: session.user.id } },
    },
    include: {
      teamA: { select: { name: true, flagEmoji: true, code: true } },
      teamB: { select: { name: true, flagEmoji: true, code: true } },
    },
    orderBy: { kickoff: "asc" },
  });

  const serialized = openMatches.map((m) => ({
    id: m.id,
    matchNumber: m.matchNumber,
    kickoff: m.kickoff.toISOString(),
    teamA: m.teamA,
    teamB: m.teamB,
    teamALabel: m.teamALabel,
    teamBLabel: m.teamBLabel,
  }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      <div>
        <Link
          href="/predict"
          className="text-xs font-medium mb-4 inline-block"
          style={{ color: "var(--muted-foreground)" }}
        >
          ← Back to predictions
        </Link>
        <h1 className="text-3xl font-bold" style={{ letterSpacing: "-0.5px", color: "var(--foreground)" }}>
          Quick predict
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          Fill in all your missing predictions at once.
        </p>
      </div>

      {serialized.length === 0 ? (
        <div
          className="rounded-2xl py-14 text-center"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>All caught up</p>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            You've predicted every open match.{" "}
            <Link href="/predict" style={{ color: "#9685E4" }}>
              Back to predictions →
            </Link>
          </p>
        </div>
      ) : (
        <BulkPredictForm matches={serialized} />
      )}
    </div>
  );
}
