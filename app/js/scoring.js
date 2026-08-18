import { createResolver, ROUNDS_INFO, NR } from './resolve.js';

// Scores one player's bracket against the official resolution of `films`.
// picksByRoundSlot: { [round]: { [slot]: film } }
export function scoreBracket(films, picksByRoundSlot) {
  const resolver = createResolver(films);
  const { resolve, computeElim, outBy } = resolver;
  computeElim();

  function pickState(r, i) {
    const M = picksByRoundSlot[r]?.[i];
    if (!M) return 'pending';
    const res = resolve(r, i);
    if (res.done) return res.winner === M ? 'correct' : 'dead';
    return outBy(M, r) ? 'dead' : 'pending';
  }

  const byRound = {};
  let total = 0;
  for (let r = 1; r <= NR; r++) {
    let t = 0;
    for (let i = 0; i < ROUNDS_INFO[r - 1].pairs; i++) if (pickState(r, i) === 'correct') t += ROUNDS_INFO[r - 1].pts;
    byRound[r] = t;
    total += t;
  }

  const champion = picksByRoundSlot[6]?.[0] || null;
  const championAlive = champion ? !outBy(champion, NR) : false;

  return { total, byRound, pickState, champion, championAlive, resolver };
}

// Standard competition ranking (1,2,2,4 — ties share a place, next place skips).
export function rankByPoints(entries) {
  const sorted = [...entries].sort((a, b) => b.total - a.total);
  let place = 0, seen = 0, lastTotal = null;
  return sorted.map((e) => {
    seen += 1;
    if (e.total !== lastTotal) { place = seen; lastTotal = e.total; }
    return { ...e, place };
  });
}
