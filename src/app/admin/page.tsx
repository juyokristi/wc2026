import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { syncScores } from "@/lib/sync-scores";
import { AdminSyncButton } from "@/components/admin-sync-button";
import { AdminFixPairingsButton } from "@/components/admin-fix-pairings-button";
import { AdminFdDebugButton } from "@/components/admin-fd-debug-button";
import { AdminRebuildBracketButton } from "@/components/admin-rebuild-bracket-button";
import { AdminPopulateR32Button } from "@/components/admin-populate-r32-button";
import { AdminScoreMatchForm } from "@/components/admin-score-match-form";
import { AdminRepairQualifiersButton } from "@/components/admin-repair-qualifiers-button";

export default async function AdminPage() {
  const session = await auth();

  if (
    !session?.user?.email ||
    session.user.email !== process.env.ADMIN_EMAIL
  ) {
    redirect("/");
  }

  async function doSync() {
    "use server";
    return syncScores();
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div>
        <p
          className="text-xs font-bold uppercase tracking-[2px] mb-2"
          style={{ color: "#9685E4" }}
        >
          Administration
        </p>
        <h1
          className="text-3xl font-bold"
          style={{ letterSpacing: "-0.5px", color: "var(--foreground)" }}
        >
          Admin
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          Manage scores and sync data from football-data.org.
        </p>
      </div>

      {/* Sync card */}
      <div
        className="rounded-2xl p-6 space-y-4"
        style={{
          border: "1px solid var(--border)",
          backgroundColor: "var(--card)",
        }}
      >
        <div>
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            Score sync
          </h2>
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--muted-foreground)" }}
          >
            Pull the latest results and kickoff times from football-data.org.
          </p>
        </div>

        <AdminSyncButton doSync={doSync} />
      </div>

      {/* Repair qualifier picks */}
      <div
        className="rounded-2xl p-6 space-y-4"
        style={{
          border: "1px solid var(--border)",
          backgroundColor: "var(--card)",
        }}
      >
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
            Repair qualifier picks
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Finds all finished knockout predictions where the qualifier pick is missing but the
            predicted score is not a draw. Auto-derives the pick from the predicted score and
            awards the +2 bonus where the pick was correct.
          </p>
        </div>
        <AdminRepairQualifiersButton />
      </div>

      {/* Manual score correction */}
      <div
        className="rounded-2xl p-6 space-y-4"
        style={{
          border: "1px solid var(--border)",
          backgroundColor: "var(--card)",
        }}
      >
        <div>
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            Correct match score
          </h2>
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--muted-foreground)" }}
          >
            Manually set the 90-min score (used for point calculation). For AET/penalty matches,
            also enter the full score for display. Rescores all predictions on save.
          </p>
        </div>
        <AdminScoreMatchForm />
      </div>

      {/* Fix group pairings */}
      <div
        className="rounded-2xl p-6 space-y-4"
        style={{
          border: "1px solid var(--border)",
          backgroundColor: "var(--card)",
        }}
      >
        <div>
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            Fix group pairings
          </h2>
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--muted-foreground)" }}
          >
            Correct group stage team assignments using the football-data.org schedule.
            Fixes matches where the seed pairings don't match the actual FIFA fixture list.
          </p>
        </div>

        <AdminFixPairingsButton />
      </div>

      {/* FD API diagnostic */}
      <div
        className="rounded-2xl p-6 space-y-4"
        style={{
          border: "1px solid var(--border)",
          backgroundColor: "var(--card)",
        }}
      >
        <div>
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            FD API diagnostic
          </h2>
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--muted-foreground)" }}
          >
            Shows what football-data.org has confirmed for knockout fixtures — which teams are TBD, which are ready to assign, and which codes are missing from our DB.
          </p>
        </div>

        <AdminFdDebugButton />
      </div>

      {/* Populate R32 from DB standings */}
      <div
        className="rounded-2xl p-6 space-y-4"
        style={{
          border: "1px solid var(--border)",
          backgroundColor: "var(--card)",
        }}
      >
        <div>
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            Populate R32 from standings
          </h2>
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--muted-foreground)" }}
          >
            Assigns all 16 R32 slots using the correct WC2026 bracket structure computed
            directly from DB group standings. No FD API needed. Overwrites existing labels
            and team assignments (except finished/live matches).
          </p>
        </div>

        <AdminPopulateR32Button />
      </div>

      {/* Rebuild bracket */}
      <div
        className="rounded-2xl p-6 space-y-4"
        style={{
          border: "1px solid var(--border)",
          backgroundColor: "var(--card)",
        }}
      >
        <div>
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            Rebuild bracket
          </h2>
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--muted-foreground)" }}
          >
            Syncs confirmed knockout team assignments directly from Football-Data.org,
            then propagates all finished-match winners into future slots and refreshes
            TBD labels. Use this to fix wrong bracket assignments.
          </p>
        </div>

        <AdminRebuildBracketButton />
      </div>
    </div>
  );
}
