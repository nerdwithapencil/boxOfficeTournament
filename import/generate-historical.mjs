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

const esc = (s) => s.replace(/'/g, "''");
let sql = `-- Historical seasons: ${Object.keys(SEASONS).join(', ')}\n\n`;

for (const [year, { winner, results }] of Object.entries(SEASONS)) {
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

writeFileSync('import/historical-seasons-import.sql', sql);
console.log(`Wrote import/historical-seasons-import.sql — ${Object.keys(SEASONS).length} seasons.`);
for (const [year, { winner, results }] of Object.entries(SEASONS)) {
  const hits = results.filter(([, , , pick]) => pick === winner).length;
  console.log(`  ${year}: ${results.length} players, winner "${winner}", ${hits} correct picks`);
}
