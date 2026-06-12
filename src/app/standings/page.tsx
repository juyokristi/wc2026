import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

type TeamRecord = {
  id: string; name: string; code: string; flagEmoji: string;
  mp: number; w: number; d: number; l: number; gf: number; ga: number;
};

function pts(t: TeamRecord) { return t.w * 3 + t.d; }
function gd(t: TeamRecord) { return t.gf - t.ga; }

export default async function StandingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const matches = await prisma.match.findMany({
    where: { stage: "GROUP" },
    include: {
      teamA: { select: { id: true, name: true, code: true, flagEmoji: true } },
      teamB: { select: { id: true, name: true, code: true, flagEmoji: true } },
    },
  });

  const groups: Record<string, Record<string, TeamRecord>> = {};

  for (const m of matches) {
    const g = m.group ?? "?";
    if (!groups[g]) groups[g] = {};

    const add = (t: { id: string; name: string; code: string; flagEmoji: string }) => {
      if (!groups[g][t.id]) groups[g][t.id] = { ...t, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
    };
    if (m.teamA) add(m.teamA);
    if (m.teamB) add(m.teamB);

    if (m.status === "FINISHED" && m.scoreA !== null && m.scoreB !== null && m.teamA && m.teamB) {
      const a = groups[g][m.teamA.id];
      const b = groups[g][m.teamB.id];
      a.mp++; b.mp++;
      a.gf += m.scoreA; a.ga += m.scoreB;
      b.gf += m.scoreB; b.ga += m.scoreA;
      if (m.scoreA > m.scoreB) { a.w++; b.l++; }
      else if (m.scoreA < m.scoreB) { a.l++; b.w++; }
      else { a.d++; b.d++; }
    }
  }

  const sorted = Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, teams]) => ({
      group,
      teams: Object.values(teams).sort((a, b) => {
        if (pts(b) !== pts(a)) return pts(b) - pts(a);
        if (gd(b) !== gd(a)) return gd(b) - gd(a);
        return b.gf - a.gf;
      }),
    }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[2px] mb-2" style={{ color: "#9685E4" }}>WC2026</p>
        <h1 className="text-3xl font-bold" style={{ letterSpacing: "-0.5px", color: "var(--foreground)" }}>
          Group Standings
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          Updated after each match. Top 2 advance; best 8 third-place teams also qualify.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map(({ group, teams }) => (
          <div
            key={group}
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
          >
            <div className="px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
              <span
                className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "rgba(150,133,228,0.1)", color: "#9685E4" }}
              >
                Group {group}
              </span>
            </div>
            <table className="w-full border-collapse table-fixed">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="px-4 py-1.5 text-left text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Team</th>
                  {["MP", "W", "D", "L", "GD"].map((h) => (
                    <th key={h} className="px-1.5 py-1.5 text-center text-xs font-medium w-8" style={{ color: "var(--muted-foreground)" }}>{h}</th>
                  ))}
                  <th className="px-3 py-1.5 text-center text-xs font-bold w-10" style={{ color: "var(--muted-foreground)" }}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team, i) => {
                  const p = pts(team);
                  const g = gd(team);
                  return (
                    <tr
                      key={team.id}
                      style={{ borderBottom: i < teams.length - 1 ? "1px solid var(--border)" : "none" }}
                    >
                      <td className="px-4 py-2 overflow-hidden">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {i < 2 && (
                            <div className="w-1 h-3.5 rounded-full shrink-0" style={{ backgroundColor: "#9685E4" }} />
                          )}
                          {i === 2 && (
                            <div className="w-1 h-3.5 rounded-full shrink-0" style={{ backgroundColor: "rgba(150,133,228,0.3)" }} />
                          )}
                          {i === 3 && <div className="w-1 shrink-0" />}
                          <span className="text-sm shrink-0">{team.flagEmoji}</span>
                          <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{team.code}</span>
                        </div>
                      </td>
                      <td className="px-1.5 py-2 text-center text-xs tabular-nums" style={{ color: "var(--muted-foreground)" }}>{team.mp}</td>
                      <td className="px-1.5 py-2 text-center text-xs tabular-nums" style={{ color: "var(--muted-foreground)" }}>{team.w}</td>
                      <td className="px-1.5 py-2 text-center text-xs tabular-nums" style={{ color: "var(--muted-foreground)" }}>{team.d}</td>
                      <td className="px-1.5 py-2 text-center text-xs tabular-nums" style={{ color: "var(--muted-foreground)" }}>{team.l}</td>
                      <td className="px-1.5 py-2 text-center text-xs tabular-nums" style={{ color: "var(--muted-foreground)" }}>{g > 0 ? `+${g}` : g}</td>
                      <td className="px-3 py-2 text-center text-sm font-bold tabular-nums" style={{ color: p > 0 ? "var(--foreground)" : "var(--muted-foreground)" }}>{p}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
