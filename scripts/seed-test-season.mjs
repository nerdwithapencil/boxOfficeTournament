// Generates supabase/seed-test-season.sql — a throwaway TEST season (year 2099)
// with 64 placeholder films, a bracket, and 63 picks for the commissioner
// account, so the My Bracket screen has real data to render against.
// Delete this season before importing the real 2026 slate (spec section 10).
//
// Run: node scripts/seed-test-season.mjs

import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';

const PLAYER_ID = '8591a194-7932-4ac4-b7c2-1b37ce5c4ddf'; // Jason, commissioner

const seedOrder = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15];
const B1 = ["Avengers: Doomsday","Mercy","The Angry Birds Movie 3","Goat","Dr. Seuss' The Cat in the Hat","Young Washington","Michael","Focker-In-Law","Street Fighter","Practical Magic 2","Hexed","Cut Off","Scream 7","Return to Silent Hill","The Super Mario Galaxy Movie","Soulm8te"];
const B2 = ["Toy Story 5","Crime 101","PAW Patrol: The Dino Movie","Untitled Spielberg Film","Animal Friends","The Dog Stars","Forgotten Island","The Breadwinner","The Odyssey","Werwulf","Moana","Remain","Insidious 6","Evil Dead Burn","Dune: Part Three","Shiver"];
const B3 = ["The Mandalorian & Grogu","Reminders of Him","The Devil Wears Prada 2","The Bride!","Project Hail Mary","The Social Reckoning","Hoppers","Archangel","Mortal Kombat II","28 Years Later: The Bone Temple","Masters of the Universe","Cliffhanger","Violent Night 2","Wuthering Heights","The Hunger Games: Sunrise on the Reaping","The Drama"];
const B4 = ["Spider-Man: Brand New Day","Power Ballad","Clayface","Ready or Not 2: Here I Come","The Mummy","Whitney Springs","The Legend of Aang: The Last Airbender","4 Kids Walk Into a Bank","Narnia: The Magician's Nephew","Scary Movie 6","Jumanji 4","Greenland 2: Migration","Coyote vs Acme","Resident Evil","Supergirl: Woman of Tomorrow","The Sheep Detectives"];

const roundsInfo = [
  { pairs: 32 }, { pairs: 16 }, { pairs: 8 }, { pairs: 4 }, { pairs: 2 }, { pairs: 1 },
];
const NR = 6;
const YEAR = 2099;

let _s = 20260812;
const rnd = () => {
  _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

let mid = 0;
const mk = (titles, bracket) =>
  titles.map((title, i) => {
    const day = 4 + Math.floor(rnd() * 355);
    const release = new Date(Date.UTC(YEAR, 0, day));
    const finalScore = Math.round(Math.max(1.1, 175 * Math.exp(-0.17 * (seedOrder[i] - 1)) * (0.55 + rnd() * 0.95)) * 100) / 100;
    return {
      id: randomUUID(),
      idx: mid++,
      title,
      bracket,
      seed: seedOrder[i],
      release,
      finalScore,
      zeroReason: null,
    };
  });

const allFilms = [...mk(B1, 1), ...mk(B2, 2), ...mk(B3, 3), ...mk(B4, 4)];

// two Round 1 pairs get a zero'd film; 6 & 7 are paired together, giving a
// live example of a tie (both $0 -> neither advances)
allFilms[6].zeroReason = 'pushed';
allFilms[7].zeroReason = 'cancelled';
allFilms[29].zeroReason = 'streaming';
allFilms[44].zeroReason = 'pushed';
allFilms.forEach((f) => { if (f.zeroReason) f.finalScore = 0; });

// mid-season cutoff: films releasing after this date have no score yet,
// UNLESS they're zero'd (those are known immediately regardless of date)
const TODAY = new Date(Date.UTC(YEAR, 7, 12));
const isKnown = (f) => (f.zeroReason ? true : f.release <= TODAY);
allFilms.forEach((f) => { f.publishedScore = isKnown(f) ? f.finalScore : null; });

// ---- resolve the FINAL outcome (ignores the mid-season cutoff) so we can
// build a plausible submitted bracket, exactly like the prototype does ----
function makeResolver(getScore) {
  const cache = {};
  return function res(r, i) {
    const key = r + ':' + i;
    if (cache[key]) return cache[key];
    let a, b, done = false, winner = null, tie = false;
    if (r === 1) {
      a = allFilms[i * 2]; b = allFilms[i * 2 + 1];
      const sa = getScore(a), sb = getScore(b);
      if (sa != null && sb != null) {
        done = true;
        if (sa === sb) tie = true; else winner = sa > sb ? a : b;
      }
    } else {
      const A = res(r - 1, i * 2), B = res(r - 1, i * 2 + 1);
      a = A.winner; b = B.winner;
      if (A.done && B.done) {
        done = true;
        if (a && b) {
          const sa = getScore(a), sb = getScore(b);
          if (sa === sb) tie = true; else winner = sa > sb ? a : b;
        } else if (a || b) {
          const solo = a || b, ss = getScore(solo);
          if (ss == null) done = false;
          else if (ss > 0) winner = solo;
          else tie = true;
        } else {
          tie = true;
        }
      }
    }
    return (cache[key] = { a, b, done, winner, tie });
  };
}

const resolveFinal = makeResolver((f) => f.finalScore);

const myPicks = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
const champ = resolveFinal(6, 0).winner;
const champAt = (r) => {
  for (let i = 0; i < roundsInfo[r - 1].pairs; i++) if (resolveFinal(r, i).winner === champ) return i;
  return -1;
};
const path = {};
for (let r = 1; r <= NR; r++) path[r] = champAt(r);

for (let i = 0; i < 32; i++) {
  const a = allFilms[i * 2], b = allFilms[i * 2 + 1], w = resolveFinal(1, i).winner;
  if (!w) { myPicks[1][i] = a; continue; }
  myPicks[1][i] = (i === path[1] || rnd() > 0.30) ? w : (w === a ? b : a);
}
for (let r = 2; r <= NR; r++) {
  for (let i = 0; i < roundsInfo[r - 1].pairs; i++) {
    const a = myPicks[r - 1][i * 2], b = myPicks[r - 1][i * 2 + 1], w = resolveFinal(r, i).winner;
    myPicks[r][i] = (w === a || w === b) ? w : (a.seed < b.seed ? a : b);
  }
}

// ---- emit SQL ----
const seasonId = randomUUID();
const bracketId = randomUUID();
const esc = (s) => s.replace(/'/g, "''");
const dateStr = (d) => d.toISOString().slice(0, 10);

let sql = `-- THROWAWAY TEST SEASON (year ${YEAR}) — placeholder films, not real data.
-- Delete this season before importing the real 2026 slate (spec section 10):
--   delete from public.seasons where year = ${YEAR};
-- (films/brackets/picks cascade-delete automatically)

insert into public.seasons (id, year, state, lock_date)
values ('${seasonId}', ${YEAR}, 'live', null);

insert into public.films (id, season_id, title, bracket, seed, release_date, score, zero_reason) values\n`;

sql += allFilms
  .map((f) => {
    const score = f.publishedScore == null ? 'null' : f.publishedScore.toFixed(2);
    const zr = f.zeroReason ? `'${f.zeroReason}'` : 'null';
    return `  ('${f.id}', '${seasonId}', '${esc(f.title)}', ${f.bracket}, ${f.seed}, '${dateStr(f.release)}', ${score}, ${zr})`;
  })
  .join(',\n') + ';\n\n';

sql += `insert into public.brackets (id, season_id, player_id, submitted_at)
values ('${bracketId}', '${seasonId}', '${PLAYER_ID}', now());\n\n`;

sql += `insert into public.picks (bracket_id, round, slot, film_id) values\n`;
const pickRows = [];
for (let r = 1; r <= NR; r++) {
  for (let i = 0; i < roundsInfo[r - 1].pairs; i++) {
    pickRows.push(`  ('${bracketId}', ${r}, ${i}, '${myPicks[r][i].id}')`);
  }
}
sql += pickRows.join(',\n') + ';\n';

writeFileSync(new URL('../supabase/seed-test-season.sql', import.meta.url), sql);
console.log('Wrote supabase/seed-test-season.sql');
console.log(`Season ${YEAR}: 64 films, 1 bracket, ${pickRows.length} picks.`);
