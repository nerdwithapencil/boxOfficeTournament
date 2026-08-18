// The official, player-independent resolution of a season's bracket — purely
// a function of films + scores. My Bracket, Standings, and Tournament all
// need this same tree; this is the one place it's computed.

export const ROUNDS_INFO = [
  { name: 'Round 1', pts: 1, pairs: 32 },
  { name: 'Round 2', pts: 2, pairs: 16 },
  { name: 'Round 3', pts: 4, pairs: 8 },
  { name: 'Quarter-Finals', pts: 8, pairs: 4 },
  { name: 'Semi-Finals', pts: 16, pairs: 2 },
  { name: 'Championship', pts: 32, pairs: 1 },
];
export const NR = 6;
export const SEED_ORDER = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15];
export const BRACKET_NAMES = ['Bracket 1', 'Bracket 2', 'Bracket 3', 'Bracket 4'];

export function sortFilms(films) {
  return [...films]
    .sort((a, b) => a.bracket - b.bracket || SEED_ORDER.indexOf(a.seed) - SEED_ORDER.indexOf(b.seed))
    .map((f) => ({ ...f, release_date: f.release_date instanceof Date ? f.release_date : new Date(f.release_date + 'T00:00:00') }));
}

export function createResolver(films) {
  const cache = {};
  function resolve(r, i) {
    const key = r + ':' + i;
    if (cache[key]) return cache[key];
    let a, b, done = false, winner = null, tie = false;
    if (r === 1) {
      a = films[i * 2]; b = films[i * 2 + 1];
      const sa = a?.score, sb = b?.score;
      if (sa != null && sb != null) {
        done = true;
        if (sa === sb) tie = true; else winner = sa > sb ? a : b;
      }
    } else {
      const A = resolve(r - 1, i * 2), B = resolve(r - 1, i * 2 + 1);
      a = A.winner; b = B.winner;
      if (A.done && B.done) {
        done = true;
        if (a && b) {
          const sa = a.score, sb = b.score;
          if (sa === sb) tie = true; else winner = sa > sb ? a : b;
        } else if (a || b) {
          const solo = a || b, ss = solo.score;
          if (ss == null) done = false;
          else if (ss > 0) winner = solo;
          else tie = true;
        } else {
          tie = true;
        }
      }
    }
    return (cache[key] = { a, b, done, winner, tie });
  }

  let elimRound = null;
  function computeElim() {
    elimRound = {};
    for (let r = 1; r <= NR; r++) {
      for (let i = 0; i < ROUNDS_INFO[r - 1].pairs; i++) {
        const res = resolve(r, i);
        if (!res.done) continue;
        const out = [];
        if (res.tie) { if (res.a) out.push(res.a); if (res.b) out.push(res.b); }
        else if (res.winner) out.push(res.winner === res.a ? res.b : res.a);
        out.forEach((m) => { if (m && elimRound[m.id] === undefined) elimRound[m.id] = r; });
      }
    }
    return elimRound;
  }
  function outBy(m, r) {
    if (!elimRound) computeElim();
    return elimRound[m.id] !== undefined && elimRound[m.id] <= r;
  }
  const pow2 = (r) => 1 << r;
  function latestPendingDate(r, i) {
    const start = i * pow2(r), end = start + pow2(r);
    let d = null;
    for (let k = start; k < end; k++) {
      const m = films[k];
      if (!m || m.score != null) continue;
      if (!d || m.release_date > d) d = m.release_date;
    }
    return d;
  }
  function slot(r, i, side) {
    if (r === 1) return { kind: 'movie', round: 1, m: films[side === 'a' ? i * 2 : i * 2 + 1] };
    const fi = side === 'a' ? i * 2 : i * 2 + 1;
    const f = resolve(r - 1, fi);
    if (!f.done) return { kind: 'tbd', by: latestPendingDate(r - 1, fi) };
    if (!f.winner) return { kind: 'tie' };
    return { kind: 'movie', round: r, m: f.winner };
  }

  return { resolve, computeElim, outBy, slot, get elimRound() { return elimRound; } };
}
