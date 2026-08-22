import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { parsePlayer, filmCatalog } from './parse.mjs';

// Pull the season_id and title->film_id mapping out of the SQL we already
// ran for Jason, so these new picks reference the exact same live film rows
// instead of regenerating a fresh (mismatched) set of UUIDs.
const existingSql = readFileSync('import/real-season-import.sql', 'utf8');

const seasonId = existingSql.match(/insert into public\.seasons.*?\n *values \('([0-9a-f-]+)'/s)[1];

const titleToId = new Map();
const filmLineRe = /\('([0-9a-f-]+)', '[0-9a-f-]+', '((?:[^']|'')*)', \d+, \d+, '[\d-]+', (?:null|[\d.]+), (?:null|'[a-z]+')\)/g;
let m;
while ((m = filmLineRe.exec(existingSql))) {
  const id = m[1];
  const title = m[2].replace(/''/g, "'");
  titleToId.set(title, id);
}
console.log(`Extracted season ${seasonId}, ${titleToId.size} films.`);
if (titleToId.size !== 64) throw new Error(`Expected 64 films, got ${titleToId.size}`);

const PLAYERS = {
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
};

let sql = `-- Brackets + picks for the 12 already-created players.\n\n`;
sql += `insert into public.brackets (id, season_id, player_id, submitted_at) values\n`;

const bracketIds = {};
const bracketRows = [];
for (const name of Object.keys(PLAYERS)) {
  const bracketId = randomUUID();
  bracketIds[name] = bracketId;
  bracketRows.push(`  ('${bracketId}', '${seasonId}', '${PLAYERS[name]}', now())`);
}
sql += bracketRows.join(',\n') + ';\n\n';

sql += `insert into public.picks (bracket_id, round, slot, film_id) values\n`;
const pickRows = [];
let anyFail = false;

for (const name of Object.keys(PLAYERS)) {
  const file = `import/${name.toLowerCase()}.csv`;
  const { picks, ok, total } = parsePlayer(file);
  console.log(`${name}: ${ok ? 'PASS' : 'FAIL'} — total ${total}`);
  if (!ok) { anyFail = true; continue; }

  const bracketId = bracketIds[name];
  for (let r = 1; r <= 6; r++) {
    const arr = picks[r];
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] == null) continue;
      const title = filmCatalog[arr[i]].title;
      const filmId = titleToId.get(title);
      if (!filmId) throw new Error(`No live film id for title "${title}" (player ${name})`);
      pickRows.push(`  ('${bracketId}', ${r}, ${i}, '${filmId}')`);
    }
  }
}

if (anyFail) throw new Error('One or more players failed checksum validation — aborting.');

sql += pickRows.join(',\n') + ';\n';
writeFileSync('import/remaining-players-import.sql', sql);
console.log(`\nWrote import/remaining-players-import.sql — ${bracketRows.length} brackets, ${pickRows.length} picks.`);
