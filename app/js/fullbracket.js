import { getCurrentSeason, getSeasonFilms } from './season.js';
import { createResolver, ROUNDS_INFO, NR, BRACKET_NAMES } from './resolve.js';

/* Ported from files/full-bracket-prototype.html. Brackets 1 & 2 run
   left-to-right down the left side, 3 & 4 run right-to-left down the right,
   converging on the Championship in the middle. In our film ordering the
   first half of every round's matchups is the left side and the second half
   is the right, so the split is just an index test — see resolve.js's slot(). */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CARD_W = 160, ROW_H = 31, CARD_H = ROW_H * 2, COL_GAP = 32, ROW_PITCH = 70;
const PAD_X = 52, PAD_TOP = 64, PAD_BOT = 40, REGION_GAP = 64;
const COLS = 11;
const colX = (c) => PAD_X + c * (CARD_W + COL_GAP);
const STAGE_W = PAD_X * 2 + COLS * CARD_W + (COLS - 1) * COL_GAP;
const STAGE_H = PAD_TOP + 16 * ROW_PITCH + REGION_GAP + PAD_BOT;

const rowY = (centreRow) =>
  PAD_TOP + centreRow * ROW_PITCH + (centreRow > 8 ? REGION_GAP : centreRow === 8 ? REGION_GAP / 2 : 0);

function place(r, i) {
  const half = ROUNDS_INFO[r - 1].pairs / 2;
  if (r === NR) return { col: 5, side: 'c', y: rowY(8) };
  const left = i < half;
  const j = left ? i : i - half;
  const span = 1 << (r - 1);
  return { col: left ? r - 1 : COLS - r, side: left ? 'l' : 'r', y: rowY((j + 0.5) * span) };
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function rowHTML(sl, res, isTie) {
  if (sl.kind === 'tbd') {
    const by = sl.by ? `${MONTHS[sl.by.getMonth()]} ${sl.by.getDate()}` : '';
    return `<div class="fb-row tbd"><span class="fb-nm">TBD</span><span class="fb-fg">${by}</span></div>`;
  }
  if (sl.kind === 'tie') return `<div class="fb-row tbd"><span class="fb-nm">Tie</span><span class="fb-fg">$0.00M</span></div>`;
  const m = sl.m, sc = m.score;
  let cls = 'fb-row';
  if (isTie) cls += ' lost';
  else if (res.done && res.winner) cls += res.winner === m ? ' won' : ' lost';
  const seed = sl.round === 1 ? `<span class="fb-sd">${m.seed}</span>` : '';
  const fig = sc != null ? `$${sc.toFixed(2)}` : `${MONTHS[m.release_date.getMonth()]} ${m.release_date.getDate()}`;
  return `<div class="${cls}">${seed}<span class="fb-nm">${escapeHtml(m.title)}</span><span class="fb-fg">${fig}</span></div>`;
}

let resolver = null;

function build() {
  const stage = document.getElementById('fbStage');
  stage.style.width = STAGE_W + 'px';
  stage.style.height = STAGE_H + 'px';
  let h = '';

  for (let r = 1; r <= NR; r++) {
    const cols = r === NR ? [5] : [r - 1, COLS - r];
    cols.forEach((c) => {
      h += `<div class="fb-roundlab" style="left:${colX(c)}px; top:34px; width:${CARD_W}px;">${ROUNDS_INFO[r - 1].name.toUpperCase()}</div>`;
    });
  }
  [0, 1, 2, 3].forEach((b) => {
    const leftSide = b < 2, lower = b % 2 === 1;
    const yTop = rowY(lower ? 8 : 0);
    const hgt = 8 * ROW_PITCH;
    const x = leftSide ? PAD_X - 30 : STAGE_W - PAD_X + 8;
    h += `<div class="fb-regionlab" style="left:${x}px; top:${yTop}px; height:${hgt}px; width:22px;">${BRACKET_NAMES[b]}</div>`;
  });

  for (let r = 1; r <= NR; r++) {
    for (let i = 0; i < ROUNDS_INFO[r - 1].pairs; i++) {
      const p = place(r, i), res = resolver.resolve(r, i), isTie = res.done && res.tie;
      const w = r === NR ? 186 : CARD_W;
      const x = r === NR ? colX(5) - (186 - CARD_W) / 2 : colX(p.col);
      const hh = r === NR ? 70 : CARD_H;
      h += `<div class="fb-m ${r === NR ? 'champ' : ''}" style="left:${x}px; top:${p.y - hh / 2}px;">${rowHTML(resolver.slot(r, i, 'a'), res, isTie)}${rowHTML(resolver.slot(r, i, 'b'), res, isTie)}</div>`;
    }
  }
  stage.innerHTML = h + `<svg class="fb-lines" id="fbLines" width="${STAGE_W}" height="${STAGE_H}"></svg>`;
  drawLines();
  fitTitles();
}

function fitTitles() {
  document.querySelectorAll('#fbStage .fb-nm').forEach((el) => {
    el.style.fontSize = '';
    let fs = 10.5;
    while (el.scrollWidth > el.clientWidth + 0.5 && fs > 7.2) {
      fs -= 0.4;
      el.style.fontSize = fs.toFixed(1) + 'px';
    }
  });
}

function drawLines() {
  let d = '';
  for (let r = 1; r < NR; r++) {
    const info = ROUNDS_INFO[r - 1];
    for (let j = 0; j < info.pairs / 2; j++) {
      const A = place(r, j * 2), B = place(r, j * 2 + 1), P = place(r + 1, j);
      if (A.side !== B.side) continue;
      const leftSide = A.side === 'l';
      const xOut = leftSide ? colX(A.col) + CARD_W : colX(A.col);
      const xIn = P.side === 'c'
        ? leftSide ? colX(5) - (186 - CARD_W) / 2 : colX(5) - (186 - CARD_W) / 2 + 186
        : leftSide ? colX(P.col) : colX(P.col) + CARD_W;
      const xMid = (xOut + xIn) / 2;
      d += `M${xOut},${A.y} H${xMid} M${xOut},${B.y} H${xMid} M${xMid},${A.y} V${B.y} M${xMid},${P.y} H${xIn} `;
    }
  }
  const svg = document.getElementById('fbLines');
  if (svg) svg.innerHTML = `<path d="${d}" stroke="var(--gold-dim)" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".8"/>`;
}

/* ---- pan + pinch ---- */
let scale = 1, tx = 0, ty = 0, minScale = 0.1, maxScale = 2.6;
const stageEl = () => document.getElementById('fbStage');
const vpEl = () => document.getElementById('fbViewport');
function apply() { stageEl().style.transform = `translate(${tx}px,${ty}px) scale(${scale})`; }

function clamp() {
  const v = vpEl(), vw = v.clientWidth, vh = v.clientHeight;
  const w = STAGE_W * scale, hgt = STAGE_H * scale;
  tx = w <= vw ? (vw - w) / 2 : Math.min(0, Math.max(vw - w, tx));
  ty = hgt <= vh ? (vh - hgt) / 2 : Math.min(0, Math.max(vh - hgt, ty));
}
function baseScale() {
  const v = vpEl();
  const portrait = v.clientHeight >= v.clientWidth;
  return portrait ? v.clientHeight / STAGE_H : v.clientWidth / STAGE_W;
}
function resetView() {
  minScale = baseScale();
  scale = minScale;
  tx = 0; ty = 0;
  clamp(); apply();
}
function zoomAt(k, cx, cy) {
  const next = Math.max(minScale, Math.min(maxScale, scale * k));
  const f = next / scale;
  tx = cx - (cx - tx) * f;
  ty = cy - (cy - ty) * f;
  scale = next; clamp(); apply();
}
function zoomBy(k) { const v = vpEl(); zoomAt(k, v.clientWidth / 2, v.clientHeight / 2); }

const pts = new Map();
let last = null, pinch = null, lastTap = 0;
function local(e) { const r = vpEl().getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

let booted = false;
let lastPortrait = null;

function onViewportChange() {
  const v = vpEl();
  if (!v || v.clientWidth === 0) return;
  const portrait = v.clientHeight >= v.clientWidth;
  if (portrait !== lastPortrait) { lastPortrait = portrait; resetView(); }
  else { minScale = baseScale(); if (scale < minScale) scale = minScale; clamp(); apply(); }
  fitTitles();
}

function boot() {
  if (booted) return;
  booted = true;
  const v = vpEl();

  v.addEventListener('pointerdown', (e) => {
    v.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, local(e));
    if (pts.size === 1) {
      last = local(e);
      v.classList.add('dragging');
      const now = performance.now();
      if (now - lastTap < 300) { const p = local(e); zoomAt(1.9, p.x, p.y); }
      lastTap = now;
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), c: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    }
  });
  v.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, local(e));
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (pinch.d > 0) {
        tx += c.x - pinch.c.x; ty += c.y - pinch.c.y;
        zoomAt(d / pinch.d, c.x, c.y);
      }
      pinch = { d, c };
    } else if (pts.size === 1 && last) {
      const p = local(e);
      tx += p.x - last.x; ty += p.y - last.y;
      last = p; clamp(); apply();
    }
  });
  function release(e) {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size === 0) { last = null; v.classList.remove('dragging'); }
    else last = [...pts.values()][0];
  }
  v.addEventListener('pointerup', release);
  v.addEventListener('pointercancel', release);
  v.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  v.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = local(e);
    zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, p.x, p.y);
  }, { passive: false });

  document.getElementById('fb-fit').addEventListener('click', resetView);
  document.getElementById('fb-zoomin').addEventListener('click', () => zoomBy(1.5));
  document.getElementById('fb-zoomout').addEventListener('click', () => zoomBy(1 / 1.5));
  window.addEventListener('resize', onViewportChange);
  if (document.fonts?.ready) document.fonts.ready.then(fitTitles);
}

export async function renderFullBracket() {
  const season = await getCurrentSeason();
  if (!season) return;
  const films = await getSeasonFilms(season.id);
  resolver = createResolver(films);
  resolver.computeElim();

  build();
  boot();
  lastPortrait = null; // force resetView on next show, since the container may have been hidden (0×0)
  requestAnimationFrame(onViewportChange);
}
