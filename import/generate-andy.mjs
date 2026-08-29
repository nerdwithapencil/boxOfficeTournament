import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { parsePlayer, filmCatalog } from './parse.mjs';

const existingSql = readFileSync('import/real-season-import.sql', 'utf8');
const seasonId = existingSql.match(/insert into public\.seasons.*?\n *values \('([0-9a-f-]+)'/s)[1];

const titleToId = new Map();
const filmLineRe = /\('([0-9a-f-]+)', '[0-9a-f-]+', '((?:[^']|'')*)', \d+, \d+, '[\d-]+', (?:null|[\d.]+), (?:null|'[a-z]+')\)/g;
let m;
while ((m = filmLineRe.exec(existingSql))) {
  titleToId.set(m[2].replace(/''/g, "'"), m[1]);
}
if (titleToId.size !== 64) throw new Error(`Expected 64 films, got ${titleToId.size}`);

const ANDY_PLAYER_ID = 'f43b79e3-e0c8-4ec6-8cf5-279dd6a7cdcd';
const bracketId = randomUUID();

const { picks, ok, total } = parsePlayer('import/andy.csv');
console.log(`Andy: ${ok ? 'PASS' : 'FAIL'} — total ${total}`);
if (!ok) throw new Error('Andy picks failed checksum validation — aborting.');

let sql = `insert into public.brackets (id, season_id, player_id, submitted_at)\n`;
sql += `values ('${bracketId}', '${seasonId}', '${ANDY_PLAYER_ID}', now());\n\n`;
sql += `insert into public.picks (bracket_id, round, slot, film_id) values\n`;

const rows = [];
for (let r = 1; r <= 6; r++) {
  const arr = picks[r];
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] == null) continue;
    const filmId = titleToId.get(filmCatalog[arr[i]].title);
    if (!filmId) throw new Error(`No live film id for "${filmCatalog[arr[i]].title}"`);
    rows.push(`  ('${bracketId}', ${r}, ${i}, '${filmId}')`);
  }
}
sql += rows.join(',\n') + ';\n';

writeFileSync('import/andy-import.sql', sql);
console.log(`Wrote import/andy-import.sql — 1 bracket, ${rows.length} picks.`);
