import { supabase } from './supabaseClient.js';
import { goTab } from './nav.js';

/* =========================================================================
   Ported from files/live-bracket-prototype.html — same layout math, same
   resolution rules. The only real change is the DATA section: instead of a
   generated fake season, everything below comes from Supabase.
   ========================================================================= */

const seedOrder = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15];
const bracketNames = ['Bracket 1', 'Bracket 2', 'Bracket 3', 'Bracket 4'];
const roundsInfo = [
  { name: 'Round 1', pts: 1, pairs: 32 },
  { name: 'Round 2', pts: 2, pairs: 16 },
  { name: 'Round 3', pts: 4, pairs: 8 },
  { name: 'Quarter-Finals', pts: 8, pairs: 4 },
  { name: 'Semi-Finals', pts: 16, pairs: 2 },
  { name: 'Championship', pts: 32, pairs: 1 },
];
const NR = 6;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (d) => `opens ${MONTHS[d.getMonth()]} ${d.getDate()}`;

let allMovies = [];
let myPicks = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

/* =========================================================================
   RESOLUTION — a matchup resolves once both sides have a score. A film's
   score being non-null already means "known", whether that's a real opening
   weekend number or a $0 forced by zero_reason — the database guarantees
   those match (films_zero_reason_implies_zero_score).
   ========================================================================= */
const scoreOf = (m) => m.score;

let resolveCache = {};
function resolve(r, i) {
  const key = r + ':' + i;
  if (resolveCache[key]) return resolveCache[key];
  let a, b, done = false, winner = null, tie = false;
  if (r === 1) {
    a = allMovies[i * 2]; b = allMovies[i * 2 + 1];
    const sa = scoreOf(a), sb = scoreOf(b);
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
        const sa = scoreOf(a), sb = scoreOf(b);
        if (sa === sb) tie = true; else winner = sa > sb ? a : b;
      } else if (a || b) {
        const solo = a || b, ss = scoreOf(solo);
        if (ss == null) done = false;
        else if (ss > 0) winner = solo;
        else tie = true;
      } else {
        tie = true;
      }
    }
  }
  return (resolveCache[key] = { a, b, done, winner, tie });
}

let elimRound = {};
function computeElim() {
  elimRound = {};
  for (let r = 1; r <= NR; r++) {
    for (let i = 0; i < roundsInfo[r - 1].pairs; i++) {
      const res = resolve(r, i);
      if (!res.done) continue;
      const out = [];
      if (res.tie) { if (res.a) out.push(res.a); if (res.b) out.push(res.b); }
      else if (res.winner) out.push(res.winner === res.a ? res.b : res.a);
      out.forEach((m) => { if (m && elimRound[m.id] === undefined) elimRound[m.id] = r; });
    }
  }
}
const outBy = (m, r) => elimRound[m.id] !== undefined && elimRound[m.id] <= r;

const myPair = (r, i) => (r === 1 ? [allMovies[i * 2], allMovies[i * 2 + 1]] : [myPicks[r - 1][i * 2], myPicks[r - 1][i * 2 + 1]]);

function pickState(r, i) {
  const M = myPicks[r][i], res = resolve(r, i);
  if (res.done) return res.winner === M ? 'correct' : 'dead';
  return outBy(M, r) ? 'dead' : 'pending';
}
function roundPoints(r) {
  let t = 0;
  for (let i = 0; i < roundsInfo[r - 1].pairs; i++) if (pickState(r, i) === 'correct') t += roundsInfo[r - 1].pts;
  return t;
}
const totalPoints = () => { let t = 0; for (let r = 1; r <= NR; r++) t += roundPoints(r); return t; };

/* =========================================================================
   LAYOUT — verbatim from the prototype (see files/BUILD-SPEC.md section 7
   for why: pitch doubles each round, so alignment is a property of the
   maths, not something to calculate).
   ========================================================================= */
const GAP = 8, LABEL_H = 18, TAB_H = 16, TOP_PAD = 30, MIN_BASE = 90;
let focus = 1, targetFocus = 1, focusAnim = null, BASE = MIN_BASE, currentRound = 1, colW = 0;
const els = {};
const vp = () => document.getElementById('viewport');
const pitch = (r) => BASE * Math.pow(2, r - focus);
const centerOf = (r, i) => TOP_PAD + (i + 0.5) * pitch(r);

function groupLabel(r, i) {
  if (r >= 4) return null;
  const per = roundsInfo[r - 1].pairs / 4;
  return i % per === 0 ? bracketNames[Math.floor(i / per)] : null;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function halfHTML(m, r, isMine, state, tie, showReason) {
  let cls = 'half ' + (isMine ? 'mine ' + state : 'other');
  if (outBy(m, r)) cls += ' gone';
  const sc = scoreOf(m);
  const figure = sc != null
    ? `<span class="fig ${sc > 0 ? 'paid' : ''}">$${sc.toFixed(2)}M${showReason && m.zero_reason ? ' · ' + m.zero_reason : ''}</span>`
    : `<span class="fig">${fmtDate(m.release_date)}</span>`;
  const seedTag = r === 1 ? `<span class="sd">${m.seed}</span>` : '';
  const tieTag = tie ? '<span class="tietag">TIE · NO ADVANCE</span>' : '';
  const top = seedTag || tieTag ? `<div class="toprow">${seedTag}${tieTag}</div>` : '';
  return `<div class="${cls}">${top}<span class="ttl">${escapeHtml(m.title)}</span>${figure}</div>`;
}

function buildCol(r) {
  const info = roundsInfo[r - 1];
  let h = '';
  for (let i = 0; i < info.pairs; i++) {
    const lab = groupLabel(r, i);
    if (lab) h += `<div class="group-label" data-i="${i}">${lab}</div>`;
    const [a, b] = myPair(r, i);
    const mine = myPicks[r][i], state = pickState(r, i), res = resolve(r, i);
    if (state !== 'pending') {
      const pts = state === 'correct' ? info.pts : 0;
      h += `<div class="ptab ${state === 'correct' ? 'good' : 'zero'}" data-i="${i}">${pts} PTS</div>`;
    }
    h += `<div class="unit" data-i="${i}">${halfHTML(a, r, mine === a, state, res.tie, r === 1)}${halfHTML(b, r, mine === b, state, res.tie, r === 1)}</div>`;
  }
  return h;
}

function build() {
  const plane = document.getElementById('plane');
  plane.innerHTML = '';
  for (let r = 1; r <= NR; r++) {
    const col = document.createElement('div');
    col.className = 'col'; col.dataset.round = r; col.innerHTML = buildCol(r);
    plane.appendChild(col);
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'lines'); svg.id = 'lines';
  plane.appendChild(svg);
  cacheEls();
}

function cacheEls() {
  for (let r = 1; r <= NR; r++) {
    const col = document.querySelector(`.col[data-round="${r}"]`);
    els[r] = {
      col,
      units: [...col.querySelectorAll('.unit')],
      labels: [...col.querySelectorAll('.group-label')].map((el) => ({ el, i: +el.dataset.i })),
      tabs: [...col.querySelectorAll('.ptab')].map((el) => ({ el, i: +el.dataset.i })),
    };
  }
  observeUnits();
}

let unitRO = null, roQueued = false;
function observeUnits() {
  if (unitRO) unitRO.disconnect();
  unitRO = new ResizeObserver(() => {
    if (roQueued) return;
    roQueued = true;
    requestAnimationFrame(() => { roQueued = false; relayoutNow(); });
  });
  for (let r = 1; r <= NR; r++) els[r]?.units.forEach((u) => unitRO.observe(u));
}

function tallestUnit() {
  let m = 0;
  for (let r = 1; r <= NR; r++) (els[r]?.units || []).forEach((u) => (m = Math.max(m, u.offsetHeight)));
  return m || 92;
}

function layout() {
  const view = vp();
  colW = view.clientWidth;
  BASE = Math.max(MIN_BASE, tallestUnit() + GAP + LABEL_H + TAB_H);
  let planeH = 0;
  for (let r = 1; r <= NR; r++) {
    const E = els[r]; if (!E) continue;
    const P = pitch(r);
    const scaleAt = (nat) => Math.max(0.08, Math.min(1, P / (nat + GAP)));
    E.units.forEach((u, i) => {
      const nat = u.offsetHeight, s = scaleAt(nat), c = centerOf(r, i);
      u.style.top = c - nat / 2 + 'px';
      u.style.transform = s < 0.999 ? `scaleY(${s})` : '';
      planeH = Math.max(planeH, c + (nat * s) / 2);
    });
    const hasTab = {};
    E.tabs.forEach(({ el, i }) => {
      const u = E.units[i]; if (!u) return;
      hasTab[i] = true;
      const nat = u.offsetHeight, s = scaleAt(nat);
      el.style.top = centerOf(r, i) - (nat * s) / 2 - 19 + 'px';
      el.style.opacity = s > 0.6 ? 1 : Math.max(0, (s - 0.35) / 0.25);
    });
    E.labels.forEach(({ el, i }) => {
      const u = E.units[i]; if (!u) return;
      const nat = u.offsetHeight, s = scaleAt(nat);
      el.style.top = centerOf(r, i) - (nat * s) / 2 - 19 - (hasTab[i] ? 23 : 0) + 'px';
      el.style.opacity = s > 0.6 ? 1 : Math.max(0, (s - 0.35) / 0.25);
    });
  }
  const plane = document.getElementById('plane');
  plane.style.height = Math.max(planeH + TOP_PAD, view.clientHeight) + 'px';
  plane.style.width = colW * NR + 'px';
  for (let r = 1; r <= NR; r++) if (els[r]) els[r].col.style.width = colW + 'px';
  applyX(baseX() + dragX);
  drawLines();
}

function drawLines() {
  const svg = document.getElementById('lines'); if (!svg) return;
  const H = parseFloat(document.getElementById('plane').style.height) || 0, W = colW;
  svg.setAttribute('width', W * NR); svg.setAttribute('height', H);
  let d = '';
  for (let r = 1; r < NR; r++) {
    const info = roundsInfo[r - 1];
    const xOut = (r - 1) * W + (W - 46), xIn = r * W + 16, xMid = (xOut + xIn) / 2;
    for (let j = 0; j < info.pairs / 2; j++) {
      const yA = centerOf(r, j * 2), yB = centerOf(r, j * 2 + 1), yP = centerOf(r + 1, j);
      d += `M${xOut},${yA} H${xMid} M${xOut},${yB} H${xMid} M${xMid},${yA} V${yB} M${xMid},${yP} H${xIn} `;
    }
  }
  svg.innerHTML = `<path d="${d}" stroke="var(--gold-dim)" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.85"/>`;
}

function capture(r) {
  const view = vp(), E = els[r];
  if (!E || !E.units.length) return null;
  const eye = view.scrollTop + view.clientHeight / 2;
  let best = 0, bd = Infinity;
  E.units.forEach((u, i) => { const d = Math.abs(centerOf(r, i) - eye); if (d < bd) { bd = d; best = i; } });
  return { r, i: best, screenY: centerOf(r, best) - view.scrollTop };
}
function restore(a) {
  if (!a) return;
  const view = vp();
  const max = Math.max(0, (parseFloat(document.getElementById('plane').style.height) || 0) - view.clientHeight);
  view.scrollTop = Math.max(0, Math.min(max, centerOf(a.r, a.i) - a.screenY));
}
function relayoutNow() { const a = capture(Math.round(focus)); layout(); restore(a); }

function animateFocus(to, anchor) {
  cancelAnimationFrame(focusAnim);
  const from = focus, t0 = performance.now(), D = 620, a = capture(anchor ?? to);
  targetFocus = to;
  const step = (now) => {
    const p = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - p, 3);
    focus = from + (to - from) * e;
    layout(); restore(a);
    if (p < 1) focusAnim = requestAnimationFrame(step);
  };
  focusAnim = requestAnimationFrame(step);
}

/* ---- horizontal paging: custom, not native (see spec section 7) ---- */
const SWIPE_MIN = 14, DOMINANCE = 1.8, COMMIT = 0.3, FLICK = 0.55, SLIDE_MS = 300;
let colIndex = 0, dragX = 0, axis = null, slideAnim = null, p0 = null;
const baseX = () => -colIndex * colW;
function applyX(px) { document.getElementById('plane').style.transform = `translateX(${px}px)`; }

function onDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  cancelAnimationFrame(slideAnim);
  p0 = { x: e.clientX, y: e.clientY, t: performance.now() };
  axis = null; dragX = 0;
}
function onMove(e) {
  if (!p0) return;
  const dx = e.clientX - p0.x, dy = e.clientY - p0.y;
  if (axis === null) {
    if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
    axis = Math.abs(dx) > Math.abs(dy) * DOMINANCE ? 'x' : 'y';
    if (axis === 'y') { p0 = null; return; }
  }
  let d = dx;
  if ((colIndex === 0 && d > 0) || (colIndex === NR - 1 && d < 0)) d *= 0.32;
  dragX = d; applyX(baseX() + dragX);
}
function onUp() {
  if (!p0 || axis !== 'x') { p0 = null; axis = null; return; }
  const dt = Math.max(1, performance.now() - p0.t), v = dragX / dt;
  let t = colIndex;
  if (Math.abs(dragX) > colW * COMMIT || Math.abs(v) > FLICK) t = colIndex - Math.sign(dragX);
  p0 = null; axis = null;
  slideTo(Math.max(0, Math.min(NR - 1, t)));
}
function slideTo(idx) {
  const from = baseX() + dragX;
  colIndex = idx; dragX = 0;
  const to = baseX(), t0 = performance.now();
  cancelAnimationFrame(slideAnim);
  const step = (now) => {
    const p = Math.min(1, (now - t0) / SLIDE_MS), e = 1 - Math.pow(1 - p, 3);
    applyX(from + (to - from) * e);
    if (p < 1) slideAnim = requestAnimationFrame(step); else finishSlide();
  };
  slideAnim = requestAnimationFrame(step);
}
function finishSlide() {
  const r = colIndex + 1;
  if (r !== currentRound) { currentRound = r; updateHeader(); }
  if (Math.abs(targetFocus - r) > 0.01 || Math.abs(focus - r) > 0.01) animateFocus(r, r);
}

function updateHeader() {
  document.getElementById('hRound').textContent = roundsInfo[currentRound - 1].name;
  document.getElementById('hRoundPts').innerHTML = `<b>${roundPoints(currentRound)}</b> PTS`;
  document.getElementById('hTotal').textContent = totalPoints();
}

/* =========================================================================
   DATA + BOOT — this is the part that replaces the prototype's fake season.
   ========================================================================= */
let booted = false;
let ownSession = null, ownDisplayName = '';

export async function renderBracket(session, displayName, opts = {}) {
  ownSession = session;
  ownDisplayName = displayName;
  const targetId = opts.playerId || session.user.id;
  const viewingOther = targetId !== session.user.id;

  const emptyState = document.getElementById('bracket-empty');
  const backBtn = document.getElementById('bracket-back-btn');
  emptyState.style.display = 'none';
  backBtn.style.display = viewingOther ? 'flex' : 'none';
  document.getElementById('hName').textContent = viewingOther ? opts.playerName : displayName;

  const { data: seasons } = await supabase
    .from('seasons')
    .select('id, year, state')
    .in('state', ['open', 'live', 'ended'])
    .order('year', { ascending: false })
    .limit(1);

  if (!seasons?.length) {
    document.getElementById('plane').innerHTML = '';
    emptyState.textContent = 'No season is open yet.';
    emptyState.style.display = 'flex';
    return;
  }
  const season = seasons[0];
  document.getElementById('hSeason').textContent = `${season.year} BOX OFFICE TOURNAMENT`;

  const { data: bracket } = await supabase
    .from('brackets')
    .select('id')
    .eq('season_id', season.id)
    .eq('player_id', targetId)
    .maybeSingle();

  if (!bracket) {
    document.getElementById('plane').innerHTML = '';
    emptyState.textContent = viewingOther
      ? "This player doesn't have a bracket for this season."
      : "You don't have a bracket for this season yet.";
    emptyState.style.display = 'flex';
    return;
  }

  const { data: films } = await supabase
    .from('films')
    .select('id, title, bracket, seed, release_date, score, zero_reason')
    .eq('season_id', season.id);

  allMovies = [...(films || [])]
    .sort((a, b) => a.bracket - b.bracket || seedOrder.indexOf(a.seed) - seedOrder.indexOf(b.seed))
    .map((f) => ({ ...f, release_date: new Date(f.release_date + 'T00:00:00') }));

  const { data: picks } = await supabase
    .from('picks')
    .select('round, slot, film_id')
    .eq('bracket_id', bracket.id);

  const byId = Object.fromEntries(allMovies.map((m) => [m.id, m]));
  myPicks = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  (picks || []).forEach((p) => { myPicks[p.round][p.slot] = byId[p.film_id]; });

  resolveCache = {};
  computeElim();

  build();
  currentRound = 1; focus = 1; targetFocus = 1; colIndex = 0;
  layout();
  applyX(0);
  updateHeader();

  if (!booted) {
    booted = true;
    document.getElementById('bracket-back-btn').addEventListener('click', () => {
      goTab('bracket');
      renderBracket(ownSession, ownDisplayName);
    });
    const V = vp();
    V.addEventListener('pointerdown', onDown);
    V.addEventListener('pointermove', onMove, { passive: true });
    V.addEventListener('pointerup', onUp);
    V.addEventListener('pointercancel', () => { p0 = null; axis = null; slideTo(colIndex); });
    new ResizeObserver(() => requestAnimationFrame(relayoutNow)).observe(V);
    if (document.fonts?.ready) document.fonts.ready.then(relayoutNow);
    window.addEventListener('resize', () => requestAnimationFrame(() => { layout(); applyX(baseX()); }));
  }
}
