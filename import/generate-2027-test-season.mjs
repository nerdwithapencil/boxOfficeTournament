import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';

// Disposable test season for ironing out the Fill Your Bracket flow before
// the real 2027 slate exists. Placeholder films only — titles/seeds/dates
// are all made up. Meant to be thrown away and replaced once the real
// 64-film list is ready (a fresh `insert into seasons` for the real season,
// not a retitle of these rows, since seeding will be completely different).

const SEED_ORDER = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15];
const seasonId = randomUUID();
const year = 2027;

let sql = `-- Disposable 2027 TEST season — placeholder films for trying out\n`;
sql += `-- Fill Your Bracket. Throw this season away once the real slate exists.\n\n`;
sql += `insert into public.seasons (id, year, state) values\n`;
sql += `  ('${seasonId}', ${year}, 'setup');\n\n`;

sql += `insert into public.films (season_id, title, bracket, seed, release_date) values\n`;
const rows = [];
let dayOffset = 3;
for (let bracket = 1; bracket <= 4; bracket++) {
  for (let rank = 0; rank < 16; rank++) {
    const seed = SEED_ORDER[rank];
    const date = new Date(Date.UTC(year, 0, 1 + dayOffset));
    dayOffset += 6;
    const iso = date.toISOString().slice(0, 10);
    rows.push(`  ('${seasonId}', 'TEST Film — B${bracket} seed ${seed}', ${bracket}, ${seed}, '${iso}')`);
  }
}
sql += rows.join(',\n') + ';\n';

writeFileSync('import/2027-test-season-import.sql', sql);
console.log(`Wrote import/2027-test-season-import.sql — season ${seasonId}, ${rows.length} placeholder films.`);
