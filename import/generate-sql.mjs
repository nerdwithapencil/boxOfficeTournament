import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';
import { filmCatalog, parsePlayer } from './parse.mjs';

const JASON_PLAYER_ID = '8591a194-7932-4ac4-b7c2-1b37ce5c4ddf';
const YEAR = 2026;

const esc = (s) => s.replace(/'/g, "''");
const dateStr = (d) => d.toISOString().slice(0, 10);
const seasonId = randomUUID();
const bracketId = randomUUID();
const filmIds = filmCatalog.map(() => randomUUID());

let sql = `-- Real ${YEAR} season import: films + Jason's bracket only.
-- Run this AFTER deleting the test season:
--   delete from public.seasons where year = 2099;

insert into public.seasons (id, year, state, lock_date)
values ('${seasonId}', ${YEAR}, 'live', null);

insert into public.films (id, season_id, title, bracket, seed, release_date, score, zero_reason) values\n`;

sql += filmCatalog
  .map((f, i) => {
    const score = f.score == null ? 'null' : f.score.toFixed(2);
    const zr = f.zero_reason ? `'${f.zero_reason}'` : 'null';
    return `  ('${filmIds[i]}', '${seasonId}', '${esc(f.title)}', ${f.bracket}, ${f.seed}, '${dateStr(f.release_date)}', ${score}, ${zr})`;
  })
  .join(',\n') + ';\n\n';

sql += `insert into public.brackets (id, season_id, player_id, submitted_at)
values ('${bracketId}', '${seasonId}', '${JASON_PLAYER_ID}', now());\n\n`;

const { picks, ok, total } = parsePlayer('import/jason.csv');
if (!ok) throw new Error('Jason picks failed checksum validation — aborting SQL generation.');

sql += `insert into public.picks (bracket_id, round, slot, film_id) values\n`;
const pickRows = [];
for (let r = 1; r <= 6; r++) {
  const arr = picks[r];
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] == null) continue;
    pickRows.push(`  ('${bracketId}', ${r}, ${i}, '${filmIds[arr[i]]}')`);
  }
}
sql += pickRows.join(',\n') + ';\n';

writeFileSync('import/real-season-import.sql', sql);
console.log(`Wrote import/real-season-import.sql`);
console.log(`${filmCatalog.length} films, 1 bracket, ${pickRows.length} picks, Jason's checksummed total: ${total}`);
