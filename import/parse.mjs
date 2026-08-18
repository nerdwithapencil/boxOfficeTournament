import { readFileSync, readdirSync } from 'fs';

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') {}
      else field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const cell = (rows, r, c) => (rows[r] && rows[r][c] !== undefined ? rows[r][c] : '');

const SEED_ORDER = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15];
const ZERO_OVERRIDES = {
  'The Legend of Aang: The Last Airbender': 'streaming',
  'Animal Friends': 'pushed',
  "Narnia: The Magician's Nephew": 'pushed',
  'Whitney Springs': 'pushed',
  'Remain': 'pushed',
  'Cliffhanger': 'pushed',
  '4 Kids Walk Into a Bank': 'pushed',
  'Soulm8te': 'pushed',
  'Shiver': 'pushed',
};

// ---- films ----
const moviesRows = parseCSV(readFileSync('import/movies.csv', 'utf8'));
const byBracketSeed = {}; // byBracketSeed[bracket][seed] = {title, score, release_date}
for (let r = 1; r < moviesRows.length; r++) {
  const rank = cell(moviesRows, r, 0).trim();
  if (!rank) continue;
  const seed = parseInt(rank, 10);
  const bracket = parseInt(cell(moviesRows, r, 1).trim(), 10);
  const title = cell(moviesRows, r, 2).trim();
  const scoreRaw = cell(moviesRows, r, 3).trim();
  const dateRaw = cell(moviesRows, r, 4).trim();
  const zero_reason = ZERO_OVERRIDES[title] || null;
  let score = null;
  if (scoreRaw) score = parseFloat(scoreRaw.replace(/[$,]/g, ''));
  let release_date;
  if (dateRaw) {
    const [m, d, y] = dateRaw.split('/').map(Number);
    release_date = new Date(Date.UTC(y, m - 1, d));
  } else {
    release_date = new Date(Date.UTC(2026, 11, 31)); // placeholder for zero'd films with no date
  }
  (byBracketSeed[bracket] ??= {})[seed] = { title, score, release_date, zero_reason, bracket, seed };
}

// global 0..63 film order: bracket1..4, each in canonical seed order
const filmCatalog = [];
for (let b = 1; b <= 4; b++) for (const seed of SEED_ORDER) filmCatalog.push(byBracketSeed[b][seed]);
const titleToIndex = new Map(filmCatalog.map((f, i) => [f.title, i]));

console.log(`Parsed ${filmCatalog.length} films.`);
const dupeCheck = new Set();
filmCatalog.forEach((f) => {
  if (dupeCheck.has(f.title)) console.log(`WARNING duplicate title: ${f.title}`);
  dupeCheck.add(f.title);
});

// ---- resolver (mirrors app/js/resolve.js, operating on filmCatalog + picks) ----
const ROUNDS = [{ pairs: 32, pts: 1 }, { pairs: 16, pts: 2 }, { pairs: 8, pts: 4 }, { pairs: 4, pts: 8 }, { pairs: 2, pts: 16 }, { pairs: 1, pts: 32 }];
function resolverFor(films) {
  const cache = {};
  function resolve(r, i) {
    const key = r + ':' + i;
    if (cache[key]) return cache[key];
    let a, b, done = false, winner = null, tie = false;
    if (r === 1) {
      a = films[i * 2]; b = films[i * 2 + 1];
      const sa = a?.score, sb = b?.score;
      if (sa != null && sb != null) { done = true; if (sa === sb) tie = true; else winner = sa > sb ? a : b; }
    } else {
      const A = resolve(r - 1, i * 2), B = resolve(r - 1, i * 2 + 1);
      a = A.winner; b = B.winner;
      if (A.done && B.done) {
        done = true;
        if (a && b) { const sa = a.score, sb = b.score; if (sa === sb) tie = true; else winner = sa > sb ? a : b; }
        else if (a || b) { const solo = a || b, ss = solo.score; if (ss == null) done = false; else if (ss > 0) winner = solo; else tie = true; }
        else tie = true;
      }
    }
    return (cache[key] = { a, b, done, winner, tie });
  }
  return resolve;
}

// ---- picks parser (see conversation for row/col derivation) ----
const filmRow = (j) => 3 + 2 * j;
function pickRow(d, k) {
  if (d === 0) throw new Error('use filmRow for d=0');
  if (d === 1) return 4 + 4 * k;
  const half = pickRow(d - 1, 2 * k), half2 = pickRow(d - 1, 2 * k + 1);
  return (half + half2) / 2;
}
const colLeft = (d) => 1 + 3 * d;
const colRight = (d) => 35 - 3 * d;
const CHAMPION_ROW = 37, CHAMPION_COL = 18;

function parsePlayer(filePath) {
  const rows = parseCSV(readFileSync(filePath, 'utf8'));

  // sanity-check raw films against catalog
  for (let j = 0; j < 32; j++) {
    const row = filmRow(j);
    const lSeed = cell(rows, row, 0).trim(), lTitle = cell(rows, row, 1).trim();
    const rTitle = cell(rows, row, 35).trim(), rSeed = cell(rows, row, 36).trim();
    const lExpected = filmCatalog[j];
    const rExpected = filmCatalog[32 + j];
    if (lTitle !== lExpected.title || +lSeed !== lExpected.seed) {
      console.log(`  MISMATCH left row${row}: got "${lTitle}"(seed ${lSeed}), expected "${lExpected.title}"(seed ${lExpected.seed})`);
    }
    if (rTitle !== rExpected.title || +rSeed !== rExpected.seed) {
      console.log(`  MISMATCH right row${row}: got "${rTitle}"(seed ${rSeed}), expected "${rExpected.title}"(seed ${rExpected.seed})`);
    }
  }

  const picks = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  const resolveTitle = (title, ctx) => {
    if (!titleToIndex.has(title)) { console.log(`  UNRESOLVED title "${title}" (${ctx})`); return null; }
    return titleToIndex.get(title);
  };

  for (let d = 1; d <= 5; d++) {
    const kMax = ROUNDS[d - 1].pairs / 2; // left+right split the round's slots evenly
    for (let k = 0; k < kMax; k++) {
      const row = pickRow(d, k);
      const lTitle = cell(rows, row, colLeft(d)).trim();
      const rTitle = cell(rows, row, colRight(d)).trim();
      const leftSlot = d === 5 ? 0 : k;
      const rightSlot = d === 5 ? 1 : kMax + k;
      picks[d][leftSlot] = resolveTitle(lTitle, `round ${d} slot ${leftSlot}`);
      picks[d][rightSlot] = resolveTitle(rTitle, `round ${d} slot ${rightSlot}`);
    }
  }
  const champTitle = cell(rows, CHAMPION_ROW, CHAMPION_COL).trim();
  picks[6][0] = resolveTitle(champTitle, 'round 6 slot 0');

  // checksum against the sheet's own displayed round-by-round points
  const num = (s) => parseFloat(String(s).replace(/[$,]/g, '')) || 0;
  const displayed = {
    1: num(cell(rows, 9, 19)), 2: num(cell(rows, 10, 19)), 3: num(cell(rows, 11, 19)),
    4: num(cell(rows, 12, 19)), 5: num(cell(rows, 13, 19)), 6: num(cell(rows, 14, 19)),
  };
  const displayedTotal = num(cell(rows, 5, 17));

  const resolve = resolverFor(filmCatalog);
  const computed = {};
  let total = 0;
  for (let r = 1; r <= 6; r++) {
    let t = 0;
    for (let i = 0; i < ROUNDS[r - 1].pairs; i++) {
      const pickIdx = picks[r][i];
      if (pickIdx == null) continue;
      const res = resolve(r, i);
      if (res.done && res.winner === filmCatalog[pickIdx]) t += ROUNDS[r - 1].pts;
    }
    computed[r] = t;
    total += t;
  }

  let ok = true;
  for (let r = 1; r <= 6; r++) {
    if (computed[r] !== displayed[r]) { console.log(`  CHECKSUM MISMATCH round ${r}: computed ${computed[r]}, sheet says ${displayed[r]}`); ok = false; }
  }
  if (total !== displayedTotal) { console.log(`  CHECKSUM MISMATCH total: computed ${total}, sheet says ${displayedTotal}`); ok = false; }

  return { picks, ok, total, computed };
}

const args = process.argv.slice(2);
const files = args.length ? args : readdirSync('import').filter((f) => f.endsWith('.csv') && f !== 'movies.csv').map((f) => 'import/' + f);

for (const f of files) {
  console.log(`\n=== ${f} ===`);
  const { ok, total } = parsePlayer(f);
  console.log(ok ? `PASS — total ${total}` : `FAIL — total ${total}`);
}

export { filmCatalog, parsePlayer, resolverFor, ROUNDS };
