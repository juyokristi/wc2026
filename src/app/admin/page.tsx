import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { syncScores } from "@/lib/sync-scores";
import { AdminSyncButton } from "@/components/admin-sync-button";
import { AdminFixPairingsButton } from "@/components/admin-fix-pairings-button";
import { AdminFixKnockoutsButton } from "@/components/admin-fix-knockouts-button";

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

      {/* Fix duplicate knockout assignments */}
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
            Fix duplicate knockout assignments
          </h2>
          <p
            className="text-sm mt-0.5"
            style={{ color: "var(--muted-foreground)" }}
          >
            Finds knockout match slots where the same team pair was accidentally
            assigned twice, clears the duplicates, then run Score Sync to repopulate correctly.
          </p>
        </div>

        <AdminFixKnockoutsButton />
      </div>
    </div>
  );
}
