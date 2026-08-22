import { getCurrentSeason, getSeasonFilms } from './season.js';
import { createResolver, ROUNDS_INFO, NR, BRACKET_NAMES } from './resolve.js';

/* Ported from files/master-bracket-prototype.html — same layout math as My
   Bracket, but neutral (no player picks): a slot just shows the actual
   winner once settled, TBD until then, or the tie/no-advance state. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (d) => `opens ${MONTHS[d.getMonth()]} ${d.getDate()}`;

let films = [];
let resolver = null;

function groupLabel(r, i) {
  if (r >= 4) return null;
  const per = ROUNDS_INFO[r - 1].pairs / 4;
  return i % per === 0 ? BRACKET_NAMES[Math.floor(i / per)] : null;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function halfHTML(sl, res, isTie) {
  if (sl.kind === 'tbd') {
    const by = sl.by ? `${MONTHS[sl.by.getMonth()]} ${sl.by.getDate()}` : '';
    return `<div class="half neutral tbd"><span class="ttl">TBD</span><span class="fig">${by}</span></div>`;
  }
  if (sl.kind === 'tie') {
    return `<div class="half neutral tieslot"><div class="toprow"><span class="tietag">NO ADVANCE</span></div><span class="ttl">Tie</span><span class="fig">$0.00M</span></div>`;
  }
  const m = sl.m, sc = m.score;
  let cls = 'half';
  if (isTie) cls += ' lost';
  else if (res.done && res.winner) cls += res.winner === m ? ' won' : ' lost';
  else cls += ' neutral';
  const figure = sc != null
    ? `<span class="fig ${sc > 0 ? 'paid' : ''}">$${sc.toFixed(2)}M${sc === 0 && m.zero_reason ? ' · ' + m.zero_reason : ''}</span>`
    : `<span class="fig">${fmtDate(m.release_date)}</span>`;
  const seedTag = sl.round === 1 ? `<span class="sd">${m.seed}</span>` : '';
  const tieTag = isTie ? '<span class="tietag">TIE · NO ADVANCE</span>' : '';
  const top = seedTag || tieTag ? `<div class="toprow">${seedTag}${tieTag}</div>` : '';
  return `<div class="${cls}">${top}<span class="ttl">${escapeHtml(m.title)}</span>${figure}</div>`;
}

function buildCol(r) {
  const info = ROUNDS_INFO[r - 1];
  let h = '';
  for (let i = 0; i < info.pairs; i++) {
    const lab = groupLabel(r, i);
    if (lab) h += `<div class="group-label" data-i="${i}">${lab}</div>`;
    const res = resolver.resolve(r, i), isTie = res.done && res.tie;
    h += `<div class="unit" data-i="${i}">${halfHTML(resolver.slot(r, i, 'a'), res, isTie)}${halfHTML(resolver.slot(r, i, 'b'), res, isTie)}</div>`;
  }
  return h;
}

function build() {
  const plane = document.getElementById('toPlane');
  plane.innerHTML = '';
  for (let r = 1; r <= NR; r++) {
    const col = document.createElement('div');
    col.className = 'col'; col.dataset.round = r; col.innerHTML = buildCol(r);
    plane.appendChild(col);
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'lines'); svg.id = 'toLines';
  plane.appendChild(svg);
  cacheEls();
}

const GAP = 2, LABEL_H = 10, TOP_PAD = 30, MIN_BASE = 70;
let focus = 1, targetFocus = 1, focusAnim = null, BASE = MIN_BASE, currentRound = 1, colW = 0;
const els = {};
const vp = () => document.getElementById('toViewport');
const pitch = (r) => BASE * Math.pow(2, r - focus);
const centerOf = (r, i) => TOP_PAD + (i + 0.5) * pitch(r);

function cacheEls() {
  for (let r = 1; r <= NR; r++) {
    const col = document.querySelector(`#toPlane .col[data-round="${r}"]`);
    els[r] = {
      col,
      units: [...col.querySelectorAll('.unit')],
      labels: [...col.querySelectorAll('.group-label')].map((el) => ({ el, i: +el.dataset.i })),
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
  BASE = Math.max(MIN_BASE, tallestUnit() + GAP + LABEL_H);
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
    E.labels.forEach(({ el, i }) => {
      const u = E.units[i]; if (!u) return;
      const nat = u.offsetHeight, s = scaleAt(nat);
      el.style.top = centerOf(r, i) - (nat * s) / 2 - 19 + 'px';
      el.style.opacity = s > 0.6 ? 1 : Math.max(0, (s - 0.35) / 0.25);
    });
  }
  const plane = document.getElementById('toPlane');
  plane.style.height = Math.max(planeH + TOP_PAD, view.clientHeight) + 'px';
  plane.style.width = colW * NR + 'px';
  for (let r = 1; r <= NR; r++) if (els[r]) els[r].col.style.width = colW + 'px';
  applyX(baseX() + dragX);
  drawLines();
}

function drawLines() {
  const svg = document.getElementById('toLines'); if (!svg) return;
  const H = parseFloat(document.getElementById('toPlane').style.height) || 0, W = colW;
  svg.setAttribute('width', W * NR); svg.setAttribute('height', H);
  let d = '';
  for (let r = 1; r < NR; r++) {
    const info = ROUNDS_INFO[r - 1];
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
  const max = Math.max(0, (parseFloat(document.getElementById('toPlane').style.height) || 0) - view.clientHeight);
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

const SWIPE_MIN = 14, DOMINANCE = 1.8, COMMIT = 0.3, FLICK = 0.55, SLIDE_MS = 300;
let colIndex = 0, dragX = 0, axis = null, slideAnim = null, p0 = null;
const baseX = () => -colIndex * colW;
function applyX(px) { document.getElementById('toPlane').style.transform = `translateX(${px}px)`; }

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
  document.getElementById('toRound').textContent = ROUNDS_INFO[currentRound - 1].name;
}

let booted = false;

export async function renderTournament() {
  const season = await getCurrentSeason();
  const emptyState = document.getElementById('tournament-empty');
  if (!season) {
    document.getElementById('toPlane').innerHTML = '';
    emptyState.textContent = 'No season is open yet.';
    emptyState.style.display = 'flex';
    return;
  }
  emptyState.style.display = 'none';
  document.getElementById('toSeason').textContent = `${season.year} BOX OFFICE TOURNAMENT`;

  films = await getSeasonFilms(season.id);
  resolver = createResolver(films);
  resolver.computeElim();

  build();
  currentRound = 1; focus = 1; targetFocus = 1; colIndex = 0;
  layout();
  applyX(0);
  updateHeader();

  if (!booted) {
    booted = true;
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
