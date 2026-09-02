import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';

const PLAYERS = {
  Jason: '8591a194-7932-4ac4-b7c2-1b37ce5c4ddf',
  Adam: '3560aa17-76b6-429f-b763-52a2e30a27d2',
  Alex: '380b2d9a-a6dd-4d7a-a4d0-5783f4097309',
  Andrew: '2f77b2e4-0618-4b02-995a-3b26c23d5a7c',
  Ben: '45eed1fc-3a68-4b52-9535-8cdfc0079439',
  Christopher: '76856f59-1787-4b32-a611-3885775dab6e',
  Daniel: 'd28381bb-cb8b-4eb5-8efa-8b93141a9868',
  George: '92e7dcf0-fdd2-4b3c-b1d7-778bfc30c93b',
  Josh: 'b405c38b-3ded-4d09-a654-32e77d5c2abe',
  Minnesota: '4d001a8b-d50c-45ff-8e14-ce12d931435e',
  Nick: 'f2669120-390c-4320-a80b-42222d0dfb8b',
  Sean: 'd3c8ff43-8ded-46d4-b280-7f070b74cee7',
  Umar: '23a3e068-2e1b-43d9-9c11-dd1c326b9529',
  Andy: 'f43b79e3-e0c8-4ec6-8cf5-279dd6a7cdcd',
};

// year -> { winner, results: [name, place, points, pick] }
// entries for players not in PLAYERS (departed, no account) are simply
// omitted from `results` — nothing is lost, since there's no profile page
// for a non-member to ever appear on.
const SEASONS = {
  2023: {
    winner: 'Barbie',
    results: [
      ['Alex', 1, 98, 'Spider-Man: Across the Spiderverse'],
      ['Nick', 2, 83, 'The Super Mario Bros. Movie'],
      ['Andrew', 4, 77, 'Guardians of the Galaxy Vol. 3'],
      ['Umar', 4, 77, 'The Super Mario Bros. Movie'],
      ['Daniel', 6, 76, 'Guardians of the Galaxy Vol. 3'],
      ['Josh', 6, 76, 'The Little Mermaid'],
      ['Sean', 8, 75, 'Guardians of the Galaxy Vol. 3'],
      ['Jason', 9, 68, 'The Little Mermaid'],
      ['Minnesota', 10, 66, 'Mission: Impossible - Dead Reckoning Part 1'],
      ['Adam', 10, 66, 'Fast X'],
      ['Ben', 13, 56, 'Ant-Man and the Wasp: Quantumania'],
    ],
  },
  2022: {
    winner: 'Doctor Strange in the Multiverse of Madness',
    results: [
      ['Alex', 1, 135, 'Doctor Strange in the Multiverse of Madness'],
      ['Josh', 2, 127, 'Doctor Strange in the Multiverse of Madness'],
      ['Ben', 3, 107, 'Avatar: The Way of Water'],
      ['Jason', 4, 99, 'Thor: Love and Thunder'],
      ['Andrew', 5, 96, 'Avatar: The Way of Water'],
      ['Minnesota', 6, 84, 'Thor: Love and Thunder'],
      ['Nick', 7, 81, 'The Super Mario Bros. Movie'],
      ['Daniel', 9, 77, 'Avatar: The Way of Water'],
      ['Sean', 10, 64, 'Black Panther: Wakanda Forever'],
    ],
  },
  2021: {
    winner: 'Spider-Man: No Way Home',
    results: [
      ['Nick', 1, 124, 'Spider-Man: No Way Home'],
      ['Andrew', 2, 118, 'Spider-Man: No Way Home'],
      ['Minnesota', 3, 110, 'Spider-Man: No Way Home'],
      ['Josh', 4, 104, 'Spider-Man: No Way Home'],
      ['Umar', 6, 79, 'The Matrix Resurrections'],
      ['Jason', 7, 77, 'The Matrix Resurrections'],
      ['Ben', 8, 65, 'Black Widow'],
    ],
  },
  2020: {
    winner: 'Bad Boys for Life',
    results: [
      ['Minnesota', 3, 41, 'Wonder Woman 1984'],
      ['Umar', 4, 41, 'Mulan'],
      ['Andrew', 5, 40, 'Wonder Woman 1984'],
      ['Jason', 7, 39, 'Wonder Woman 1984'],
      ['Josh', 7, 39, 'Wonder Woman 1984'],
      ['Nick', 14, 22, 'Black Widow'],
      ['Ben', 15, 21, 'Black Widow'],
      ['Sean', 15, 21, 'Ghostbusters Afterlife'],
    ],
  },
  2019: {
    winner: 'The Lion King',
    results: [
      ['Jason', 1, 159, 'The Lion King'],
      ['Josh', 2, 159, 'The Lion King'],
      ['Ben', 4, 141, 'Frozen 2'],
      ['Umar', 4, 141, 'The Lion King'],
      ['Minnesota', 7, 130, 'Captain Marvel'],
      ['Andrew', 8, 127, 'Frozen 2'],
      ['Sean', 12, 109, 'Captain Marvel'],
    ],
  },
  2018: {
    winner: 'The Avengers: Infinity War',
    results: [
      ['Ben', 1, 160, 'The Avengers: Infinity War'],
      ['Jason', 3, 136, 'The Avengers: Infinity War'],
      ['Minnesota', 5, 76, 'Solo - A Star Wars Story'],
    ],
  },
  2025: {
    winner: 'A Minecraft Movie',
    results: [
      ['Alex', 1, 130, 'Wicked Part Two'],
      ['Andrew', 2, 120, 'Superman'],
      ['Ben', 3, 119, 'Avatar: Ash and Fire'],
      ['Umar', 4, 114, 'Avatar: Ash and Fire'],
      ['Josh', 5, 110, 'Superman'],
      ['Jason', 6, 107, 'Avatar: Ash and Fire'],
      ['Minnesota', 7, 99, 'Wicked Part Two'],
      ['Daniel', 8, 92, 'Avatar: Ash and Fire'],
      ['Sean', 8, 92, 'Avatar: Ash and Fire'],
      ['Christopher', 10, 87, 'Zootopia 2'],
      ['Nick', 11, 82, 'Avatar: Ash and Fire'],
      ['Adam', 12, 61, 'Dirty Dancing 2'],
    ],
  },
  2024: {
    winner: 'Deadpool & Wolverine',
    results: [
      ['Daniel', 1, 130, 'Deadpool & Wolverine'],
      ['Minnesota', 2, 128, 'Deadpool & Wolverine'],
      ['Jason', 3, 128, 'Deadpool & Wolverine'],
      ['Ben', 4, 123, 'Deadpool & Wolverine'],
      ['Nick', 5, 121, 'Deadpool & Wolverine'],
      ['Alex', 6, 114, 'Deadpool & Wolverine'],
      ['Josh', 7, 109, 'Joker: Folie a Deux'],
      ['Christopher', 8, 88, 'Joker: Folie a Deux'],
      ['Andrew', 9, 81, 'Despicable Me 4'],
      ['Adam', 10, 76, 'Furiosa'],
      ['Umar', 11, 70, 'Inside Out 2'],
      // place 12: departed player, no account — omitted
      ['Sean', 13, 57, 'Joker: Folie a Deux'],
    ],
  },
};

// 2024/2025 were already generated + applied in a prior run (see
// historical-seasons-import.sql) — re-running with the full SEASONS dict
// would re-insert them under new random season ids and duplicate them.
// Only emit years not yet applied here.
const ALREADY_APPLIED = [2024, 2025];
const OUTPUT_FILE = 'import/historical-seasons-import-2.sql';
const yearsToWrite = Object.entries(SEASONS).filter(([year]) => !ALREADY_APPLIED.includes(Number(year)));

const esc = (s) => s.replace(/'/g, "''");
let sql = `-- Historical seasons: ${yearsToWrite.map(([y]) => y).join(', ')}\n\n`;

for (const [year, { winner, results }] of yearsToWrite) {
  const seasonId = randomUUID();
  sql += `insert into public.seasons (id, year, state, is_historical) values\n`;
  sql += `  ('${seasonId}', ${year}, 'ended', true);\n\n`;

  sql += `insert into public.season_results (season_id, player_id, place, points, champion_title, champion_hit) values\n`;
  const rows = results.map(([name, place, points, pick]) => {
    const playerId = PLAYERS[name];
    if (!playerId) throw new Error(`Unknown player "${name}" in ${year} data`);
    const hit = pick === winner;
    return `  ('${seasonId}', '${playerId}', ${place}, ${points}, '${esc(pick)}', ${hit})`;
  });
  sql += rows.join(',\n') + ';\n\n';
}

writeFileSync(OUTPUT_FILE, sql);
console.log(`Wrote ${OUTPUT_FILE} — ${yearsToWrite.length} seasons.`);
for (const [year, { winner, results }] of yearsToWrite) {
  const hits = results.filter(([, , , pick]) => pick === winner).length;
  console.log(`  ${year}: ${results.length} players, winner "${winner}", ${hits} correct picks`);
}
