import { supabase } from './supabaseClient.js';
import { getCurrentSeason, getAllSeasons } from './season.js';
import { buildEntries } from './standings.js';
import { rankByPoints } from './scoring.js';

/* =========================================================================
   SCORES — ported from files/commissioner-prototype.html. Class names are
   prefixed c- to avoid colliding with the Standings/Profile row styles
   already in the stylesheet.
   ========================================================================= */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;
const iso = (d) => d.toISOString().slice(0, 10);
const ZERO_LABELS = { streaming: 'Streaming', cancelled: 'Cancelled', pushed: 'Pushed to next year' };

let season = null;
let films = [];
let sortBy = 'release';
let openId = null;
const SORTS = [['release', 'RELEASE'], ['seed', 'RANK'], ['name', 'A–Z'], ['score', 'SCORE']];

// Tracks whether any score has been saved since the last "Update Standings"
// press — independent of whether that score actually moved anyone's rank,
// since the point is to remind the commissioner a commit is worth doing,
// not to judge whether it'll matter.
let scoresDirty = false;
function setCommitButtonDirty(dirty) {
  scoresDirty = dirty;
  document.getElementById('comm-commit-btn')?.classList.toggle('secondary', !dirty);
}

async function loadFilms() {
  season = await getCurrentSeason();
  if (!season) { films = []; return; }
  const { data } = await supabase
    .from('films')
    .select('id, title, bracket, seed, release_date, score, zero_reason')
    .eq('season_id', season.id);
  films = (data || []).map((f) => ({ ...f, release_date: new Date(f.release_date + 'T00:00:00') }));
}

function needsScore(m) {
  return !m.zero_reason && m.score == null && m.release_date <= new Date();
}

function stateHTML(m) {
  if (m.zero_reason) return `<div class="c-state zero">$0.00M<br>${ZERO_LABELS[m.zero_reason]}</div>`;
  if (m.score != null) return `<div class="c-state paid">$${m.score.toFixed(2)}M</div>`;
  if (needsScore(m)) return `<div class="c-state due">NEEDS SCORE</div>`;
  return `<div class="c-state wait">${short(m.release_date)}</div>`;
}

function ordered(list) {
  const by = {
    release: (a, b) => a.release_date - b.release_date,
    seed: (a, b) => a.seed - b.seed || a.bracket - b.bracket,
    name: (a, b) => a.title.localeCompare(b.title),
    score: (a, b) => (b.score ?? -1) - (a.score ?? -1) || a.release_date - b.release_date,
  }[sortBy];
  return [...list].sort(by);
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

export function renderScores() {
  const listEl = document.getElementById('comm-scores-list');
  const chipsEl = document.getElementById('comm-scores-chips');
  const clearBtn = document.getElementById('comm-scores-clear');
  const q = document.getElementById('comm-scores-search').value.trim().toLowerCase();
  clearBtn.classList.toggle('show', q !== '');

  chipsEl.innerHTML = SORTS.map(([k, l]) => `<div class="chip ${sortBy === k ? 'on' : ''}" data-sort="${k}">${l}</div>`).join('');
  chipsEl.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => { sortBy = c.dataset.sort; openId = null; renderScores(); }));

  if (!season) { listEl.innerHTML = `<div class="c-empty">No season yet.</div>`; return; }

  const rows = ordered(films.filter((m) => !q || m.title.toLowerCase().includes(q)));
  listEl.innerHTML = rows.length
    ? rows.map((m) => `
      <div class="c-row ${openId === m.id ? 'open' : ''}">
        <div class="c-top" data-toggle="${m.id}">
          <div class="c-sd"><b>${m.seed}</b>B${m.bracket}</div>
          <div class="c-mid"><div class="c-nm">${escapeHtml(m.title)}</div><div class="c-sub">opens ${short(m.release_date)}</div></div>
          ${stateHTML(m)}
        </div>
        <div class="c-edit">
          <div class="c-lab">FILM TITLE</div>
          <input class="c-in" id="cf-n-${m.id}" value="${m.title.replace(/"/g, '&quot;')}">
          <div class="c-lab">RELEASE DATE</div>
          <input class="c-in mono" type="date" id="cf-d-${m.id}" value="${iso(m.release_date)}" ${m.zero_reason ? 'disabled' : ''}>
          <div class="c-lab">OPENING WEEKEND</div>
          <div class="c-money"><span>$</span>
            <input class="c-in mono" type="number" step="0.01" placeholder="0.00" id="cf-s-${m.id}"
                   value="${m.score != null && !m.zero_reason ? m.score.toFixed(2) : ''}" ${m.zero_reason ? 'disabled' : ''}></div>
          <div class="c-lab">NEVER OPENED IN THEATRES</div>
          <div class="c-reasons">
            ${[['', 'In theatres'], ['streaming', 'Streaming'], ['cancelled', 'Cancelled'], ['pushed', 'Pushed to next year']]
              .map(([v, l]) => `<div class="c-rz ${v === '' ? 'none' : ''} ${(m.zero_reason || '') === v ? 'on' : ''}" data-zero-id="${m.id}" data-zero-v="${v}">${l}</div>`).join('')}
          </div>
          <button class="c-save" data-save="${m.id}">Save</button>
        </div>
      </div>`).join('')
    : `<div class="c-empty">Nothing here right now.</div>`;

  listEl.querySelectorAll('[data-toggle]').forEach((el) => el.addEventListener('click', () => {
    openId = openId === el.dataset.toggle ? null : el.dataset.toggle;
    renderScores();
  }));
  listEl.querySelectorAll('[data-zero-id]').forEach((el) => el.addEventListener('click', () => {
    const m = films.find((f) => f.id === el.dataset.zeroId);
    m.zero_reason = el.dataset.zeroV || null;
    if (m.zero_reason) m.score = 0;
    else if (m.score === 0) m.score = null;
    renderScores();
  }));
  listEl.querySelectorAll('[data-save]').forEach((el) => el.addEventListener('click', () => saveFilm(el.dataset.save)));
}

async function saveFilm(id) {
  const m = films.find((f) => f.id === id);
  const title = document.getElementById(`cf-n-${id}`).value.trim() || m.title;
  let release_date = m.release_date;
  let score = m.zero_reason ? 0 : null;

  if (!m.zero_reason) {
    const rawDate = document.getElementById(`cf-d-${id}`).value;
    if (rawDate) release_date = new Date(rawDate + 'T00:00:00');
    const rawScore = document.getElementById(`cf-s-${id}`).value;
    score = rawScore === '' ? null : Math.round(parseFloat(rawScore) * 100) / 100;
  }

  const { error } = await supabase
    .from('films')
    .update({ title, release_date: iso(release_date), score, zero_reason: m.zero_reason })
    .eq('id', id);

  if (error) { alert(error.message); return; }

  // We already know the new values — update local state instead of a second
  // round-trip to re-fetch all 64 films just to redraw one row.
  m.title = title;
  m.release_date = release_date;
  m.score = score;

  if (score !== null) setCommitButtonDirty(true);

  openId = null;
  renderScores();
  showToast('Saved');
}

function showToast(msg) {
  const t = document.getElementById('comm-toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1400);
}

export async function openScores() {
  await loadFilms();
  document.getElementById('comm-scores-search').value = '';
  openId = null;
  renderScores();
  setCommitButtonDirty(scoresDirty);
  document.getElementById('commissionerScoresOverlay').classList.add('open');
}

// Standings "movement" is measured against this snapshot, not inferred from
// film release dates — press after a batch of score edits to make that
// batch's effect on everyone's rank visible. Editing a title/date without
// touching any score is harmless to press too: since nobody's points
// actually changed, the new snapshot comes out identical to the old one and
// movement still correctly reads as "—" for everyone.
export async function commitStandings() {
  if (!season) return;
  const entries = await buildEntries(season, films, { user: { id: '' } });
  const ranked = rankByPoints(entries);
  const takenAt = new Date().toISOString();
  const rows = ranked.map((e) => ({
    season_id: season.id,
    player_id: e.playerId,
    place: e.place,
    points: e.total,
    taken_at: takenAt,
  }));
  const { error } = await supabase.from('standings_snapshot').upsert(rows, { onConflict: 'season_id,player_id' });
  if (error) { alert(error.message); return; }
  setCommitButtonDirty(false);
  showToast('Standings updated');
}

/* =========================================================================
   SEASONS — state transitions, spec section 5. Nothing moves on a date;
   every change is a button here, enforced by RLS as commissioner-only.
   ========================================================================= */

const STATE_LABEL = { setup: 'SETUP', open: 'TAKING PICKS', live: 'LIVE', ended: 'FINAL' };

async function submissionSummary(seasonId) {
  const { data: players } = await supabase.from('players').select('id, display_name');
  const { data: brackets } = await supabase.from('brackets').select('id, player_id').eq('season_id', seasonId);
  const bracketByPlayer = Object.fromEntries((brackets || []).map((b) => [b.player_id, b.id]));
  const bracketIds = (brackets || []).map((b) => b.id);
  const { data: picks } = bracketIds.length
    ? await supabase.from('picks').select('bracket_id').in('bracket_id', bracketIds)
    : { data: [] };
  const pickCount = {};
  (picks || []).forEach((p) => { pickCount[p.bracket_id] = (pickCount[p.bracket_id] || 0) + 1; });

  const total = (players || []).length;
  const missing = (players || [])
    .filter((p) => (pickCount[bracketByPlayer[p.id]] || 0) < 63)
    .map((p) => p.display_name);
  return { done: total - missing.length, total, missing };
}

async function unscoredCount(seasonId) {
  const { data } = await supabase.from('films').select('id, score').eq('season_id', seasonId);
  return (data || []).filter((f) => f.score == null).length;
}

async function filmCount(seasonId) {
  const { count } = await supabase.from('films').select('id', { count: 'exact', head: true }).eq('season_id', seasonId);
  return count || 0;
}

export async function renderSeasonsAdmin() {
  const listEl = document.getElementById('comm-seasons-list');
  const seasons = await getAllSeasons();
  if (!seasons.length) { listEl.innerHTML = `<div class="c-empty">No seasons yet.</div>`; return; }

  const cards = await Promise.all(seasons.map(async (sn) => {
    let action = '', note = '';
    if (sn.state === 'setup') {
      const n = await filmCount(sn.id);
      action = `<button data-act="open|${sn.id}" ${n !== 64 ? 'disabled' : ''}>Open for picks</button>`;
      note = n === 64 ? 'Ready to open.' : `${n} of 64 films imported. Import the rest first.`;
    } else if (sn.state === 'open') {
      const sub = await submissionSummary(sn.id);
      action = `<button data-act="launch|${sn.id}">Launch tournament</button>`;
      note = `${sub.done} of ${sub.total} brackets submitted.` + (sub.missing.length ? ` Still waiting on ${sub.missing.join(', ')}.` : '');
    } else if (sn.state === 'live') {
      const un = await unscoredCount(sn.id);
      action = `<button class="secondary" data-act="end|${sn.id}">End tournament</button>`;
      note = un === 0 ? 'Every film has a score — ready to end whenever you like.' : `${un} film${un === 1 ? '' : 's'} still without a score.`;
    } else {
      note = 'Finished. Still readable by everyone, and listed in each profile.';
    }
    return `<div class="sncard">
      <div class="snhead"><b>${sn.year}</b><span class="snstate st-${sn.state}">${STATE_LABEL[sn.state]}</span></div>
      <div class="snnote">${note}</div>
      <div style="display:flex; gap:8px;">
        ${action}
        <button class="secondary" data-export="${sn.id}|${sn.year}">Export</button>
      </div></div>`;
  }));

  listEl.innerHTML = cards.join('');
  listEl.querySelectorAll('[data-act]').forEach((btn) => btn.addEventListener('click', () => seasonAction(btn.dataset.act)));
  listEl.querySelectorAll('[data-export]').forEach((btn) => btn.addEventListener('click', () => {
    const [id, year] = btn.dataset.export.split('|');
    exportSeason(id, year);
  }));
}

// One-button disaster-recovery dump: everything needed to rebuild this
// season from scratch (spec section 11 — free-tier Supabase has no
// automatic backups).
async function exportSeason(seasonId, year) {
  const [{ data: season }, { data: films }, { data: players }, { data: brackets }] = await Promise.all([
    supabase.from('seasons').select('*').eq('id', seasonId).single(),
    supabase.from('films').select('*').eq('season_id', seasonId),
    supabase.from('players').select('*'),
    supabase.from('brackets').select('*').eq('season_id', seasonId),
  ]);

  const bracketIds = (brackets || []).map((b) => b.id);
  const { data: picks } = bracketIds.length
    ? await supabase.from('picks').select('*').in('bracket_id', bracketIds)
    : { data: [] };

  const payload = {
    exported_at: new Date().toISOString(),
    season,
    films,
    players,
    brackets,
    picks,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `box-office-bracket-${year}-export.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function seasonAction(act) {
  const [kind, id] = act.split('|');

  if (kind === 'open') {
    const { error } = await supabase.from('seasons').update({ state: 'open' }).eq('id', id);
    if (error) { alert(error.message); return; }
  }

  if (kind === 'launch') {
    const sub = await submissionSummary(id);
    const msg = sub.missing.length
      ? `Launch this season?\n\n${sub.done} of ${sub.total} brackets are in. These aren't:\n${sub.missing.join(', ')}\n\nTheir picks lock exactly as they stand.`
      : `Launch this season?\n\nAll ${sub.total} brackets are in. Picks lock and everyone's bracket becomes visible.`;
    if (!confirm(msg)) return;
    const { error } = await supabase.from('seasons').update({ state: 'live' }).eq('id', id);
    if (error) { alert(error.message); return; }
  }

  if (kind === 'end') {
    const un = await unscoredCount(id);
    if (!confirm(`End this season?\n\n${un ? un + ' films still have no score. ' : ''}It stops being the current season, moves into everyone's history, and stays readable.`)) return;
    const { error } = await supabase.from('seasons').update({ state: 'ended' }).eq('id', id);
    if (error) { alert(error.message); return; }
  }

  renderSeasonsAdmin();
}

export async function openSeasonsAdmin() {
  await renderSeasonsAdmin();
  document.getElementById('commissionerSeasonsOverlay').classList.add('open');
}
