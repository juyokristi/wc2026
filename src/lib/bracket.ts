import { prisma } from "@/lib/prisma";

// Each finished match's winner feeds into a specific slot in the next round.
// This is the authoritative bracket wiring for WC2026.
export const BRACKET_FEEDERS: Record<
  number,
  { homeFeeder: number; awayFeeder: number; loser?: true }
> = {
  // R16: wiring verified against official WC2026 bracket draw
  89:  { homeFeeder: 74,  awayFeeder: 77  }, // R16 M89 Philadelphia: W(GER/PAR)=Paraguay vs W(FRA/SWE)
  90:  { homeFeeder: 73,  awayFeeder: 75  }, // R16 M90 Houston:      W(RSA/CAN)=Canada  vs W(NED/MAR)=Morocco
  91:  { homeFeeder: 76,  awayFeeder: 78  }, // R16 M91 E.Rutherford: W(BRA/JPN)=Brazil  vs W(CIV/NOR)
  92:  { homeFeeder: 79,  awayFeeder: 80  }, // R16 M92 Mexico City:  W(MEX/ECU)         vs W(ENG/COD)
  93:  { homeFeeder: 83,  awayFeeder: 84  }, // R16 M93 Arlington:    W(POR/CRO)         vs W(ESP/AUT)
  94:  { homeFeeder: 81,  awayFeeder: 82  }, // R16 M94 Seattle:      W(USA/BIH)         vs W(BEL/SEN)
  95:  { homeFeeder: 86,  awayFeeder: 88  }, // R16 M95 Atlanta:      W(ARG/CPV)         vs W(AUS/EGY)
  96:  { homeFeeder: 85,  awayFeeder: 87  }, // R16 M96 Vancouver:    W(SUI/ALG)         vs W(COL/GHA)
  // QF: verified against official schedule
  97:  { homeFeeder: 89,  awayFeeder: 90  }, // QF M97 Foxborough: W(M89) vs W(M90)
  98:  { homeFeeder: 93,  awayFeeder: 94  }, // QF M98 Inglewood:  W(M93) vs W(M94)
  99:  { homeFeeder: 91,  awayFeeder: 92  }, // QF M99 Miami:      W(M91) vs W(M92)
  100: { homeFeeder: 95,  awayFeeder: 96  }, // QF M100 K.City:   W(M95) vs W(M96)
  101: { homeFeeder: 97,  awayFeeder: 98  }, // SF M1
  102: { homeFeeder: 99,  awayFeeder: 100 }, // SF M2
  103: { homeFeeder: 101, awayFeeder: 102, loser: true }, // 3rd place: L(SF1) vs L(SF2)
  104: { homeFeeder: 101, awayFeeder: 102 }, // Final: W(SF1) vs W(SF2)
};

type MatchSnapshot = {
  id: string;
  matchNumber: number;
  status: string;
  teamAId: string | null;
  teamBId: string | null;
  teamALabel: string | null;
  teamBLabel: string | null;
  winnerId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  teamAName: string | null;
  teamBName: string | null;
};

function getLoserId(m: MatchSnapshot): string | null {
  if (!m.winnerId || !m.teamAId || !m.teamBId) return null;
  return m.teamAId === m.winnerId ? m.teamBId : m.teamAId;
}

// Generates a human-readable placeholder for a slot whose team is not yet known.
// Recurses one level through feeder labels so "W of Spain & Morocco" stays readable.
function computeLabel(
  feederNum: number,
  prefix: "W" | "L",
  byNum: Map<number, MatchSnapshot>
): string {
  const feeder = byNum.get(feederNum);
  if (!feeder) return `${prefix}${feederNum}`;
  const nameA = feeder.teamAName ?? feeder.teamALabel;
  const nameB = feeder.teamBName ?? feeder.teamBLabel;
  if (nameA && nameB) return `${prefix} of ${nameA} & ${nameB}`;
  if (nameA) return `${prefix} of ${nameA}'s path`;
  if (nameB) return `${prefix} of ${nameB}'s path`;
  return `${prefix}${feederNum}`;
}

// Rebuilds all R16-and-later bracket assignments from the current set of finished results.
//
// Design principles:
//   - FINISHED and LIVE matches are never touched (they were played with the correct teams).
//   - When a feeder match is FINISHED, its winner (or loser for 3rd place) is always written
//     to the target slot — even if a different team was already there from a stale prior sync.
//   - When a feeder match is not yet FINISHED, the target's teamId is left unchanged (it may
//     have been pre-populated by populate-r32 with a standings-derived team, which is correct).
//   - Labels are always recomputed, never left stale.
//   - If teams are changing on a slot that accumulated a stale score, the score is cleared and
//     prediction pointsEarned is reset to null (the predictions themselves are never deleted).
export async function rebuildBracket(): Promise<{
  assigned: number;
  labelsUpdated: number;
}> {
  const rows = await prisma.match.findMany({
    where: { stage: { not: "GROUP" } },
    select: {
      id: true,
      matchNumber: true,
      status: true,
      teamAId: true,
      teamBId: true,
      teamALabel: true,
      teamBLabel: true,
      winnerId: true,
      scoreA: true,
      scoreB: true,
      teamA: { select: { name: true } },
      teamB: { select: { name: true } },
    },
  });

  const byNum = new Map<number, MatchSnapshot>(
    rows.map((r) => [
      r.matchNumber,
      {
        id: r.id,
        matchNumber: r.matchNumber,
        status: r.status,
        teamAId: r.teamAId,
        teamBId: r.teamBId,
        teamALabel: r.teamALabel,
        teamBLabel: r.teamBLabel,
        winnerId: r.winnerId,
        scoreA: r.scoreA,
        scoreB: r.scoreB,
        teamAName: r.teamA?.name ?? null,
        teamBName: r.teamB?.name ?? null,
      },
    ])
  );

  let assigned = 0;
  let labelsUpdated = 0;

  for (const [targetNumStr, feeders] of Object.entries(BRACKET_FEEDERS)) {
    const target = byNum.get(Number(targetNumStr));
    if (!target) continue;
    if (target.status === "FINISHED" || target.status === "LIVE") continue;

    const homeFeed = byNum.get(feeders.homeFeeder);
    const awayFeed = byNum.get(feeders.awayFeeder);

    const prefix = feeders.loser ? "L" : "W";

    // All BRACKET_FEEDERS targets are R16 or later — populate-r32 never touches them.
    // So: if the feeder is FINISHED take its winner/loser; otherwise the slot must be null (TBD).
    // This clears any stale wrong assignment left by a previous incorrect bracket wiring.
    const newHomeId =
      homeFeed?.status === "FINISHED"
        ? (feeders.loser ? getLoserId(homeFeed) : homeFeed.winnerId) ?? null
        : null;

    const newAwayId =
      awayFeed?.status === "FINISHED"
        ? (feeders.loser ? getLoserId(awayFeed) : awayFeed.winnerId) ?? null
        : null;

    // Labels: null means "team is confirmed — show via relation"; string means TBD placeholder.
    const newHomeLabel = newHomeId ? null : computeLabel(feeders.homeFeeder, prefix, byNum);
    const newAwayLabel = newAwayId ? null : computeLabel(feeders.awayFeeder, prefix, byNum);

    const homeChanged = newHomeId !== target.teamAId;
    const awayChanged = newAwayId !== target.teamBId;
    const homeLabelChanged = newHomeLabel !== target.teamALabel;
    const awayLabelChanged = newAwayLabel !== target.teamBLabel;

    if (!homeChanged && !awayChanged && !homeLabelChanged && !awayLabelChanged) continue;

    const teamsChanging = homeChanged || awayChanged;
    const hasStaleScore = target.scoreA !== null || target.scoreB !== null;

    if (teamsChanging && hasStaleScore) {
      // The accumulated score belongs to the wrong match-up; invalidate prediction points
      // so they aren't credited against a game that hasn't happened yet.
      await prisma.prediction.updateMany({
        where: { matchId: target.id },
        data: { pointsEarned: null },
      });
    }

    await prisma.match.update({
      where: { id: target.id },
      data: {
        teamAId: newHomeId,
        teamBId: newAwayId,
        teamALabel: newHomeLabel,
        teamBLabel: newAwayLabel,
        ...(teamsChanging && hasStaleScore
          ? { status: "SCHEDULED", scoreA: null, scoreB: null, winnerId: null }
          : {}),
      },
    });

    if (homeChanged || awayChanged) assigned++;
    if (homeLabelChanged || awayLabelChanged) labelsUpdated++;
  }

  return { assigned, labelsUpdated };
}
