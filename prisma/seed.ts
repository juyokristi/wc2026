import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient, MatchStage } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const teams = [
  // Group A
  { name: "Mexico",       code: "MEX", flagEmoji: "🇲🇽", group: "A", confederation: "CONCACAF" },
  { name: "South Africa", code: "RSA", flagEmoji: "🇿🇦", group: "A", confederation: "CAF" },
  { name: "South Korea",  code: "KOR", flagEmoji: "🇰🇷", group: "A", confederation: "AFC" },
  { name: "Czechia",      code: "CZE", flagEmoji: "🇨🇿", group: "A", confederation: "UEFA" },
  // Group B
  { name: "Canada",              code: "CAN", flagEmoji: "🇨🇦", group: "B", confederation: "CONCACAF" },
  { name: "Qatar",               code: "QAT", flagEmoji: "🇶🇦", group: "B", confederation: "AFC" },
  { name: "Switzerland",         code: "SUI", flagEmoji: "🇨🇭", group: "B", confederation: "UEFA" },
  { name: "Bosnia-Herzegovina",  code: "BIH", flagEmoji: "🇧🇦", group: "B", confederation: "UEFA" },
  // Group C
  { name: "Brazil",   code: "BRA", flagEmoji: "🇧🇷", group: "C", confederation: "CONMEBOL" },
  { name: "Morocco",  code: "MAR", flagEmoji: "🇲🇦", group: "C", confederation: "CAF" },
  { name: "Haiti",    code: "HAI", flagEmoji: "🇭🇹", group: "C", confederation: "CONCACAF" },
  { name: "Scotland", code: "SCO", flagEmoji: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", group: "C", confederation: "UEFA" },
  // Group D
  { name: "United States", code: "USA", flagEmoji: "🇺🇸", group: "D", confederation: "CONCACAF" },
  { name: "Paraguay",      code: "PAR", flagEmoji: "🇵🇾", group: "D", confederation: "CONMEBOL" },
  { name: "Türkiye",       code: "TUR", flagEmoji: "🇹🇷", group: "D", confederation: "UEFA" },
  { name: "Australia",     code: "AUS", flagEmoji: "🇦🇺", group: "D", confederation: "AFC" },
  // Group E
  { name: "Germany",     code: "GER", flagEmoji: "🇩🇪", group: "E", confederation: "UEFA" },
  { name: "Ivory Coast", code: "CIV", flagEmoji: "🇨🇮", group: "E", confederation: "CAF" },
  { name: "Ecuador",     code: "ECU", flagEmoji: "🇪🇨", group: "E", confederation: "CONMEBOL" },
  { name: "Curaçao",     code: "CUW", flagEmoji: "🇨🇼", group: "E", confederation: "CONCACAF" },
  // Group F
  { name: "Japan",       code: "JPN", flagEmoji: "🇯🇵", group: "F", confederation: "AFC" },
  { name: "Netherlands", code: "NED", flagEmoji: "🇳🇱", group: "F", confederation: "UEFA" },
  { name: "Sweden",      code: "SWE", flagEmoji: "🇸🇪", group: "F", confederation: "UEFA" },
  { name: "Tunisia",     code: "TUN", flagEmoji: "🇹🇳", group: "F", confederation: "CAF" },
  // Group G
  { name: "Belgium",     code: "BEL", flagEmoji: "🇧🇪", group: "G", confederation: "UEFA" },
  { name: "Egypt",       code: "EGY", flagEmoji: "🇪🇬", group: "G", confederation: "CAF" },
  { name: "Iran",        code: "IRN", flagEmoji: "🇮🇷", group: "G", confederation: "AFC" },
  { name: "New Zealand", code: "NZL", flagEmoji: "🇳🇿", group: "G", confederation: "OFC" },
  // Group H
  { name: "Spain",        code: "ESP", flagEmoji: "🇪🇸", group: "H", confederation: "UEFA" },
  { name: "Saudi Arabia", code: "KSA", flagEmoji: "🇸🇦", group: "H", confederation: "AFC" },
  { name: "Uruguay",      code: "URU", flagEmoji: "🇺🇾", group: "H", confederation: "CONMEBOL" },
  { name: "Cape Verde",   code: "CPV", flagEmoji: "🇨🇻", group: "H", confederation: "CAF" },
  // Group I
  { name: "France",   code: "FRA", flagEmoji: "🇫🇷", group: "I", confederation: "UEFA" },
  { name: "Senegal",  code: "SEN", flagEmoji: "🇸🇳", group: "I", confederation: "CAF" },
  { name: "Iraq",     code: "IRQ", flagEmoji: "🇮🇶", group: "I", confederation: "AFC" },
  { name: "Norway",   code: "NOR", flagEmoji: "🇳🇴", group: "I", confederation: "UEFA" },
  // Group J
  { name: "Argentina", code: "ARG", flagEmoji: "🇦🇷", group: "J", confederation: "CONMEBOL" },
  { name: "Algeria",   code: "ALG", flagEmoji: "🇩🇿", group: "J", confederation: "CAF" },
  { name: "Austria",   code: "AUT", flagEmoji: "🇦🇹", group: "J", confederation: "UEFA" },
  { name: "Jordan",    code: "JOR", flagEmoji: "🇯🇴", group: "J", confederation: "AFC" },
  // Group K
  { name: "Portugal",   code: "POR", flagEmoji: "🇵🇹", group: "K", confederation: "UEFA" },
  { name: "Colombia",   code: "COL", flagEmoji: "🇨🇴", group: "K", confederation: "CONMEBOL" },
  { name: "Congo DR",   code: "COD", flagEmoji: "🇨🇩", group: "K", confederation: "CAF" },
  { name: "Uzbekistan", code: "UZB", flagEmoji: "🇺🇿", group: "K", confederation: "AFC" },
  // Group L
  { name: "England", code: "ENG", flagEmoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "L", confederation: "UEFA" },
  { name: "Croatia", code: "CRO", flagEmoji: "🇭🇷", group: "L", confederation: "UEFA" },
  { name: "Ghana",   code: "GHA", flagEmoji: "🇬🇭", group: "L", confederation: "CAF" },
  { name: "Panama",  code: "PAN", flagEmoji: "🇵🇦", group: "L", confederation: "CONCACAF" },
];

// Group stage: matchday dates per group (approximate — adjust to actual FIFA schedule)
const groupKickoffs: Record<string, { md1: string[]; md2: string[]; md3: string[] }> = {
  A: { md1: ["2026-06-11T20:00:00", "2026-06-12T17:00:00"], md2: ["2026-06-15T20:00:00", "2026-06-16T17:00:00"], md3: ["2026-06-19T20:00:00", "2026-06-19T20:00:00"] },
  B: { md1: ["2026-06-12T20:00:00", "2026-06-13T17:00:00"], md2: ["2026-06-16T20:00:00", "2026-06-17T17:00:00"], md3: ["2026-06-20T20:00:00", "2026-06-20T20:00:00"] },
  C: { md1: ["2026-06-13T20:00:00", "2026-06-14T17:00:00"], md2: ["2026-06-17T20:00:00", "2026-06-18T17:00:00"], md3: ["2026-06-21T20:00:00", "2026-06-21T20:00:00"] },
  D: { md1: ["2026-06-12T17:00:00", "2026-06-14T20:00:00"], md2: ["2026-06-16T17:00:00", "2026-06-18T20:00:00"], md3: ["2026-06-22T20:00:00", "2026-06-22T20:00:00"] },
  E: { md1: ["2026-06-13T17:00:00", "2026-06-15T17:00:00"], md2: ["2026-06-17T17:00:00", "2026-06-19T17:00:00"], md3: ["2026-06-23T20:00:00", "2026-06-23T20:00:00"] },
  F: { md1: ["2026-06-14T20:00:00", "2026-06-15T20:00:00"], md2: ["2026-06-18T20:00:00", "2026-06-19T20:00:00"], md3: ["2026-06-24T20:00:00", "2026-06-24T20:00:00"] },
  G: { md1: ["2026-06-13T20:00:00", "2026-06-14T17:00:00"], md2: ["2026-06-17T20:00:00", "2026-06-18T17:00:00"], md3: ["2026-06-21T20:00:00", "2026-06-21T20:00:00"] },
  H: { md1: ["2026-06-14T17:00:00", "2026-06-15T17:00:00"], md2: ["2026-06-18T17:00:00", "2026-06-19T17:00:00"], md3: ["2026-06-22T20:00:00", "2026-06-22T20:00:00"] },
  I: { md1: ["2026-06-13T17:00:00", "2026-06-16T17:00:00"], md2: ["2026-06-17T17:00:00", "2026-06-20T17:00:00"], md3: ["2026-06-23T20:00:00", "2026-06-23T20:00:00"] },
  J: { md1: ["2026-06-14T20:00:00", "2026-06-16T20:00:00"], md2: ["2026-06-18T20:00:00", "2026-06-20T20:00:00"], md3: ["2026-06-24T20:00:00", "2026-06-24T20:00:00"] },
  K: { md1: ["2026-06-15T17:00:00", "2026-06-16T20:00:00"], md2: ["2026-06-19T17:00:00", "2026-06-20T20:00:00"], md3: ["2026-06-25T20:00:00", "2026-06-25T20:00:00"] },
  L: { md1: ["2026-06-15T20:00:00", "2026-06-16T17:00:00"], md2: ["2026-06-19T20:00:00", "2026-06-20T17:00:00"], md3: ["2026-06-26T20:00:00", "2026-06-26T20:00:00"] },
};

const groupVenues: Record<string, { venue: string; city: string; country: string }[]> = {
  A: [{ venue: "SoFi Stadium", city: "Los Angeles", country: "USA" }, { venue: "Rose Bowl", city: "Pasadena", country: "USA" }],
  B: [{ venue: "BC Place", city: "Vancouver", country: "Canada" }, { venue: "BMO Field", city: "Toronto", country: "Canada" }],
  C: [{ venue: "Estadio Azteca", city: "Mexico City", country: "Mexico" }, { venue: "Estadio BBVA", city: "Monterrey", country: "Mexico" }],
  D: [{ venue: "MetLife Stadium", city: "New York/NJ", country: "USA" }, { venue: "Gillette Stadium", city: "Boston", country: "USA" }],
  E: [{ venue: "AT&T Stadium", city: "Dallas", country: "USA" }, { venue: "NRG Stadium", city: "Houston", country: "USA" }],
  F: [{ venue: "Mercedes-Benz Stadium", city: "Atlanta", country: "USA" }, { venue: "Hard Rock Stadium", city: "Miami", country: "USA" }],
  G: [{ venue: "Lincoln Financial Field", city: "Philadelphia", country: "USA" }, { venue: "Arrowhead Stadium", city: "Kansas City", country: "USA" }],
  H: [{ venue: "Levi's Stadium", city: "San Francisco", country: "USA" }, { venue: "State Farm Stadium", city: "Phoenix", country: "USA" }],
  I: [{ venue: "Estadio Guadalajara", city: "Guadalajara", country: "Mexico" }, { venue: "CenturyLink Field", city: "Seattle", country: "USA" }],
  J: [{ venue: "Arrowhead Stadium", city: "Kansas City", country: "USA" }, { venue: "SoFi Stadium", city: "Los Angeles", country: "USA" }],
  K: [{ venue: "Camping World Stadium", city: "Orlando", country: "USA" }, { venue: "Bank of America Stadium", city: "Charlotte", country: "USA" }],
  L: [{ venue: "MetLife Stadium", city: "New York/NJ", country: "USA" }, { venue: "BC Place", city: "Vancouver", country: "Canada" }],
};

async function main() {
  console.log("Seeding teams...");
  await prisma.team.deleteMany();
  await prisma.match.deleteMany();
  await prisma.prediction.deleteMany();

  const createdTeams: Record<string, string> = {};
  for (const team of teams) {
    const t = await prisma.team.create({ data: team });
    createdTeams[team.code] = t.id;
  }
  console.log(`Created ${teams.length} teams`);

  const teamsByGroup: Record<string, typeof teams> = {};
  for (const team of teams) {
    if (!teamsByGroup[team.group]) teamsByGroup[team.group] = [];
    teamsByGroup[team.group].push(team);
  }

  console.log("Seeding group stage matches...");
  let matchNumber = 1;

  for (const group of "ABCDEFGHIJKL".split("")) {
    const groupTeams = teamsByGroup[group];
    const kickoffs = groupKickoffs[group];
    const venues = groupVenues[group];

    // Standard round-robin pairings for 4 teams
    const matchdays = [
      { md: 1, pairs: [[0, 1], [2, 3]] },
      { md: 2, pairs: [[0, 2], [1, 3]] },
      { md: 3, pairs: [[0, 3], [1, 2]] },
    ];

    for (const { md, pairs } of matchdays) {
      const mdKey = `md${md}` as "md1" | "md2" | "md3";
      for (let i = 0; i < pairs.length; i++) {
        const [a, b] = pairs[i];
        const teamA = groupTeams[a];
        const teamB = groupTeams[b];
        const venue = venues[i % venues.length];
        await prisma.match.create({
          data: {
            matchNumber: matchNumber++,
            stage: MatchStage.GROUP,
            group,
            matchday: md,
            teamAId: createdTeams[teamA.code],
            teamBId: createdTeams[teamB.code],
            teamALabel: teamA.name,
            teamBLabel: teamB.name,
            kickoff: new Date(kickoffs[mdKey][i]),
            venue: venue.venue,
            city: venue.city,
            country: venue.country,
          },
        });
      }
    }
  }
  console.log(`Created ${matchNumber - 1} group stage matches`);

  console.log("Seeding knockout matches...");
  const knockoutMatches = [
    // Round of 32
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_32, kickoff: "2026-06-29T20:00:00", teamALabel: "1st Group A", teamBLabel: "2nd Group B", venue: "MetLife Stadium", city: "New York/NJ", country: "USA" },
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_32, kickoff: "2026-06-29T16:00:00", teamALabel: "1st Group C", teamBLabel: "2nd Group D", venue: "SoFi Stadium", city: "Los Angeles", country: "USA" },
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_32, kickoff: "2026-06-30T20:00:00", teamALabel: "1st Group E", teamBLabel: "2nd Group F", venue: "AT&T Stadium", city: "Dallas", country: "USA" },
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_32, kickoff: "2026-06-30T16:00:00", teamALabel: "1st Group G", teamBLabel: "2nd Group H", venue: "Hard Rock Stadium", city: "Miami", country: "USA" },
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_32, kickoff: "2026-07-01T20:00:00", teamALabel: "1st Group I", teamBLabel: "2nd Group J", venue: "BC Place", city: "Vancouver", country: "Canada" },
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_32, kickoff: "2026-07-01T16:00:00", teamALabel: "1st Group K", teamBLabel: "2nd Group L", venue: "Estadio Azteca", city: "Mexico City", country: "Mexico" },
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_32, kickoff: "2026-07-02T20:00:00", teamALabel: "1st Group B", teamBLabel: "2nd Group A", venue: "Levi's Stadium", city: "San Francisco", country: "USA" },
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_32, kickoff: "2026-07-02T16:00:00", teamALabel: "1st Group D", teamBLabel: "2nd Group C", venue: "Arrowhead Stadium", city: "Kansas City", country: "USA" },
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_32, kickoff: "2026-07-03T20:00:00", teamALabel: "1st Group F", teamBLabel: "2nd Group E", venue: "Mercedes-Benz Stadium", city: "Atlanta", country: "USA" },
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_32, kickoff: "2026-07-03T16:00:00", teamALabel: "1st Group H", teamBLabel: "2nd Group G", venue: "State Farm Stadium", city: "Phoenix", country: "USA" },
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_32, kickoff: "2026-07-04T20:00:00", teamALabel: "1st Group J", teamBLabel: "2nd Group I", venue: "NRG Stadium", city: "Houston", country: "USA" },
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_32, kickoff: "2026-07-04T16:00:00", teamALabel: "1st Group L", teamBLabel: "2nd Group K", venue: "Estadio BBVA", city: "Monterrey", country: "Mexico" },
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_32, kickoff: "2026-07-05T20:00:00", teamALabel: "Best 3rd (A/B/C/D)", teamBLabel: "Best 3rd (E/F/G/H)", venue: "BMO Field", city: "Toronto", country: "Canada" },
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_32, kickoff: "2026-07-05T16:00:00", teamALabel: "Best 3rd (I/J/K/L)", teamBLabel: "3rd Runner-up", venue: "Bank of America Stadium", city: "Charlotte", country: "USA" },
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_32, kickoff: "2026-07-06T20:00:00", teamALabel: "Winner R32 M1", teamBLabel: "Winner R32 M2", venue: "Lincoln Financial Field", city: "Philadelphia", country: "USA" },
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_32, kickoff: "2026-07-06T16:00:00", teamALabel: "Winner R32 M3", teamBLabel: "Winner R32 M4", venue: "Camping World Stadium", city: "Orlando", country: "USA" },
    // Round of 16
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_16, kickoff: "2026-07-09T20:00:00", teamALabel: "Winner R32 M1", teamBLabel: "Winner R32 M2", venue: "MetLife Stadium", city: "New York/NJ", country: "USA" },
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_16, kickoff: "2026-07-09T16:00:00", teamALabel: "Winner R32 M3", teamBLabel: "Winner R32 M4", venue: "SoFi Stadium", city: "Los Angeles", country: "USA" },
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_16, kickoff: "2026-07-10T20:00:00", teamALabel: "Winner R32 M5", teamBLabel: "Winner R32 M6", venue: "AT&T Stadium", city: "Dallas", country: "USA" },
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_16, kickoff: "2026-07-10T16:00:00", teamALabel: "Winner R32 M7", teamBLabel: "Winner R32 M8", venue: "Hard Rock Stadium", city: "Miami", country: "USA" },
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_16, kickoff: "2026-07-11T20:00:00", teamALabel: "Winner R32 M9", teamBLabel: "Winner R32 M10", venue: "BC Place", city: "Vancouver", country: "Canada" },
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_16, kickoff: "2026-07-11T16:00:00", teamALabel: "Winner R32 M11", teamBLabel: "Winner R32 M12", venue: "Estadio Azteca", city: "Mexico City", country: "Mexico" },
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_16, kickoff: "2026-07-12T20:00:00", teamALabel: "Winner R32 M13", teamBLabel: "Winner R32 M14", venue: "Levi's Stadium", city: "San Francisco", country: "USA" },
    { matchNumber: matchNumber++, stage: MatchStage.ROUND_OF_16, kickoff: "2026-07-12T16:00:00", teamALabel: "Winner R32 M15", teamBLabel: "Winner R32 M16", venue: "Arrowhead Stadium", city: "Kansas City", country: "USA" },
    // Quarter-Finals
    { matchNumber: matchNumber++, stage: MatchStage.QUARTER_FINAL, kickoff: "2026-07-15T20:00:00", teamALabel: "Winner R16 M1", teamBLabel: "Winner R16 M2", venue: "MetLife Stadium", city: "New York/NJ", country: "USA" },
    { matchNumber: matchNumber++, stage: MatchStage.QUARTER_FINAL, kickoff: "2026-07-15T16:00:00", teamALabel: "Winner R16 M3", teamBLabel: "Winner R16 M4", venue: "SoFi Stadium", city: "Los Angeles", country: "USA" },
    { matchNumber: matchNumber++, stage: MatchStage.QUARTER_FINAL, kickoff: "2026-07-16T20:00:00", teamALabel: "Winner R16 M5", teamBLabel: "Winner R16 M6", venue: "AT&T Stadium", city: "Dallas", country: "USA" },
    { matchNumber: matchNumber++, stage: MatchStage.QUARTER_FINAL, kickoff: "2026-07-16T16:00:00", teamALabel: "Winner R16 M7", teamBLabel: "Winner R16 M8", venue: "Hard Rock Stadium", city: "Miami", country: "USA" },
    // Semi-Finals
    { matchNumber: matchNumber++, stage: MatchStage.SEMI_FINAL, kickoff: "2026-07-19T20:00:00", teamALabel: "Winner QF M1", teamBLabel: "Winner QF M2", venue: "MetLife Stadium", city: "New York/NJ", country: "USA" },
    { matchNumber: matchNumber++, stage: MatchStage.SEMI_FINAL, kickoff: "2026-07-19T16:00:00", teamALabel: "Winner QF M3", teamBLabel: "Winner QF M4", venue: "SoFi Stadium", city: "Los Angeles", country: "USA" },
    // Third Place
    { matchNumber: matchNumber++, stage: MatchStage.THIRD_PLACE, kickoff: "2026-07-22T20:00:00", teamALabel: "Loser SF M1", teamBLabel: "Loser SF M2", venue: "Hard Rock Stadium", city: "Miami", country: "USA" },
    // Final
    { matchNumber: matchNumber++, stage: MatchStage.FINAL, kickoff: "2026-07-23T20:00:00", teamALabel: "Winner SF M1", teamBLabel: "Winner SF M2", venue: "MetLife Stadium", city: "New York/NJ", country: "USA" },
  ];

  for (const m of knockoutMatches) {
    await prisma.match.create({
      data: {
        matchNumber: m.matchNumber,
        stage: m.stage,
        kickoff: new Date(m.kickoff),
        teamALabel: m.teamALabel,
        teamBLabel: m.teamBLabel,
        venue: m.venue,
        city: m.city,
        country: m.country,
      },
    });
  }
  console.log(`Created ${knockoutMatches.length} knockout matches`);
  console.log("Seeding complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
