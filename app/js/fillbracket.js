import { supabase } from './supabaseClient.js';
import { getOpenSeason } from './season.js';
import { ROUNDS_INFO, NR, BRACKET_NAMES, sortFilms } from './resolve.js';

/* =========================================================================
   FILL YOUR BRACKET — ported from files/bracket-fill-prototype.html, same
   layout math as My Bracket/Tournament (see BUILD-SPEC.md section 7). The
   real work here vs. those read-only screens is that a tap writes a pick.

   A season only shows up here while its state is 'open' (getOpenSeason).
   If it's also still commissioner_preview, only the commissioner can reach
   it at all — the season is genuinely open and picks are genuinely
   writable, but the tab itself stays hidden from everyone else until the
   commissioner flips that off. See login.js for the tab-visibility check.
   ========================================================================= */

let season = null;
let bracketId = null;
let films = [];
let picks = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

function pairFor(r, i) {
  if (r === 1) return [films[i * 2], films[i * 2 + 1]];
  return [picks[r - 1][i * 2], picks[r - 1][i * 2 + 1]];
}
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

function buildCol(r) {
  const info = ROUNDS_INFO[r - 1];
  let h = '';
  for (let i = 0; i < info.pairs; i++) {
    const lab = groupLabel(r, i);
    if (lab) h += `<div class="group-label" data-i="${i}">${lab}</div>`;
    const [a, b] = pairFor(r, i);
    if (!a || !b) {
      h += `<div class="unit locked" data-i="${i}"><div class="lockmsg">Finish ${ROUNDS_INFO[r - 2].name} to unlock</div></div>`;
      continue;
    }
    const p = picks[r][i];
    const clsA = p === undefined ? 'half' : p === a ? 'half mine pending' : 'half other';
    const clsB = p === undefined ? 'half' : p === b ? 'half mine pending' : 'half other';
    const seedA = r === 1 ? `<span class="sd">${a.seed}</span>` : '';
    const seedB = r === 1 ? `<span class="sd">${b.seed}</span>` : '';
    h += `<div class="unit" data-i="${i}">
      <div class="${clsA}" data-pick="${r}:${i}:${a.id}">${seedA}<span class="ttl">${escapeHtml(a.title)}</span></div>
      <div class="${clsB}" data-pick="${r}:${i}:${b.id}">${seedB}<span class="ttl">${escapeHtml(b.title)}</span></div>
    </div>`;
  }
  return h;
}

function build() {
  const plane = document.getElementById('fillPlane');
  plane.innerHTML = '';
  for (let r = 1; r <= NR; r++) {
    const col = document.createElement('div');
    col.className = 'col'; col.dataset.round = r; col.innerHTML = buildCol(r);
    plane.appendChild(col);
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'lines'); svg.id = 'fillLines';
  plane.appendChild(svg);
  cacheEls();
}

const GAP = 2, LABEL_H = 10, TOP_PAD = 30, MIN_BASE = 70;
let focus = 1, targetFocus = 1, focusAnim = null, BASE = MIN_BASE, currentRound = 1, colW = 0;
const els = {};
const vp = () => document.getElementById('fillViewport');
const pitch = (r) => BASE * Math.pow(2, r - focus);
const EXTRA_GROUP_GAP = 20;
function groupOffset(r, i) {
  if (r > 3) return 0;
  const groupSize = ROUNDS_INFO[r - 1].pairs / 4;
  return EXTRA_GROUP_GAP * Math.floor(i / groupSize);
}
const centerOf = (r, i) => TOP_PAD + (i + 0.5) * pitch(r) + groupOffset(r, i);

function cacheEls() {
  for (let r = 1; r <= NR; r++) {
    const col = document.querySelector(`#fillPlane .col[data-round="${r}"]`);
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
  const plane = document.getElementById('fillPlane');
  plane.style.height = Math.max(planeH + TOP_PAD, view.clientHeight) + 'px';
  plane.style.width = colW * NR + 'px';
  for (let r = 1; r <= NR; r++) if (els[r]) els[r].col.style.width = colW + 'px';
  applyX(baseX() + dragX);
  drawLines();
}

function drawLines() {
  const svg = document.getElementById('fillLines'); if (!svg) return;
  const H = parseFloat(document.getElementById('fillPlane').style.height) || 0, W = colW;
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
  const max = Math.max(0, (parseFloat(document.getElementById('fillPlane').style.height) || 0) - view.clientHeight);
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
function applyX(px) { document.getElementById('fillPlane').style.transform = `translateX(${px}px)`; }

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
  document.getElementById('fillRound').textContent = ROUNDS_INFO[currentRound - 1].name;
  updateProgress();
}

/* =========================================================================
   PICKING — a tap sets the local pick, invalidates any now-orphaned picks
   downstream (a Round 1 change can knock out choices all the way to the
   Championship), redraws only what changed, then persists both the new
   pick and any deletions.
   ========================================================================= */
function invalidate(r, i, goneFilm) {
  const cleared = [];
  let rr = r + 1, ii = Math.floor(i / 2);
  while (rr <= NR) {
    const cur = picks[rr] ? picks[rr][ii] : undefined;
    if (cur === undefined || cur !== goneFilm) break;
    picks[rr][ii] = undefined;
    cleared.push({ round: rr, slot: ii });
    goneFilm = cur;
    ii = Math.floor(ii / 2);
    rr++;
  }
  return cleared;
}

async function pick(r, i, filmId) {
  const [a, b] = pairFor(r, i);
  if (!a || !b) return;
  const chosen = a.id === filmId ? a : b;
  if (picks[r][i] === chosen) return;
  const prev = picks[r][i];
  picks[r][i] = chosen;
  const cleared = prev !== undefined ? invalidate(r, i, prev) : [];

  const u = els[r].units[i];
  const hv = u.querySelectorAll('.half');
  hv[0].classList.remove('mine', 'pending', 'other');
  hv[1].classList.remove('mine', 'pending', 'other');
  hv[0].classList.add(...(chosen === a ? ['mine', 'pending'] : ['other']));
  hv[1].classList.add(...(chosen === b ? ['mine', 'pending'] : ['other']));

  for (let k = r + 1; k <= NR; k++) els[k].col.innerHTML = buildCol(k);
  cacheEls();
  const anc = capture(Math.round(focus));
  layout(); restore(anc);
  updateProgress();

  await supabase.from('picks').upsert(
    { bracket_id: bracketId, round: r, slot: i, film_id: chosen.id },
    { onConflict: 'bracket_id,round,slot' }
  );
  for (const c of cleared) {
    await supabase.from('picks').delete().eq('bracket_id', bracketId).eq('round', c.round).eq('slot', c.slot);
  }
}

function updateProgress() {
  const info = ROUNDS_INFO[currentRound - 1];
  const made = (picks[currentRound] || []).filter(Boolean).length;
  const left = info.pairs - made;
  document.getElementById('fillProgress').textContent =
    left === 0 ? `${info.name} complete` : `${left} pick${left !== 1 ? 's' : ''} left in ${info.name}`;
}

async function submitBracket() {
  const msgEl = document.getElementById('fillSubmitMsg');
  const miss = [];
  ROUNDS_INFO.forEach((info, idx) => {
    const made = (picks[idx + 1] || []).filter(Boolean).length;
    if (made < info.pairs) miss.push(`${info.name} (${made}/${info.pairs})`);
  });
  if (miss.length) {
    msgEl.textContent = `Finish these before submitting: ${miss.join(', ')}`;
    msgEl.className = 'submit-msg';
    return;
  }
  const { error } = await supabase.from('brackets').update({ submitted_at: new Date().toISOString() }).eq('id', bracketId);
  if (error) { msgEl.textContent = error.message; msgEl.className = 'submit-msg'; return; }
  msgEl.textContent = 'Bracket submitted — you can keep changing picks any time before the season launches.';
  msgEl.className = 'submit-msg success';
}

/* =========================================================================
   DATA + BOOT
   ========================================================================= */
let booted = false;

export async function getFillSeason(isCommissioner) {
  const open = await getOpenSeason();
  if (!open) return null;
  if (open.commissioner_preview && !isCommissioner) return null;
  return open;
}

export async function renderFillBracket(session, isCommissioner) {
  const emptyState = document.getElementById('fillbracket-empty');
  emptyState.style.display = 'none';

  season = await getFillSeason(isCommissioner);
  if (!season) {
    document.getElementById('fillPlane').innerHTML = '';
    emptyState.textContent = 'No season is open for picks right now.';
    emptyState.style.display = 'flex';
    return;
  }
  document.getElementById('fillSeason').textContent = `${season.year} BOX OFFICE TOURNAMENT`;
  document.getElementById('fillPreviewBadge').style.display = season.commissioner_preview ? 'block' : 'none';

  const { data: filmRows } = await supabase
    .from('films')
    .select('id, title, bracket, seed, release_date, score, zero_reason')
    .eq('season_id', season.id);
  films = sortFilms(filmRows || []);

  let { data: bracket } = await supabase
    .from('brackets')
    .select('id')
    .eq('season_id', season.id)
    .eq('player_id', session.user.id)
    .maybeSingle();

  if (!bracket) {
    const { data: created, error } = await supabase
      .from('brackets')
      .insert({ season_id: season.id, player_id: session.user.id })
      .select('id')
      .single();
    if (error) {
      emptyState.textContent = error.message;
      emptyState.style.display = 'flex';
      return;
    }
    bracket = created;
  }
  bracketId = bracket.id;

  const { data: pickRows } = await supabase
    .from('picks')
    .select('round, slot, film_id')
    .eq('bracket_id', bracketId);

  const byId = Object.fromEntries(films.map((m) => [m.id, m]));
  picks = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  (pickRows || []).forEach((p) => { picks[p.round][p.slot] = byId[p.film_id]; });

  build();
  currentRound = 1; focus = 1; targetFocus = 1; colIndex = 0;
  layout();
  applyX(0);
  updateHeader();

  if (!booted) {
    booted = true;
    document.getElementById('fillPlane').addEventListener('click', (e) => {
      const el = e.target.closest('[data-pick]');
      if (!el) return;
      const [r, i, filmId] = el.dataset.pick.split(':');
      pick(+r, +i, filmId);
    });
    document.getElementById('fill-submit-btn').addEventListener('click', submitBracket);
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
