import { supabase } from './supabaseClient.js';
import { getCurrentSeason, getSeasonFilms } from './season.js';
import { scoreBracket, rankByPoints } from './scoring.js';
import { goTab } from './nav.js';
import { renderBracket } from './bracket.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function buildEntries(season, films, session) {
  const { data: players } = await supabase.from('players').select('id, display_name');
  const { data: brackets } = await supabase.from('brackets').select('id, player_id').eq('season_id', season.id);

  const bracketIds = (brackets || []).map((b) => b.id);
  const { data: picks } = bracketIds.length
    ? await supabase.from('picks').select('bracket_id, round, slot, film_id').in('bracket_id', bracketIds)
    : { data: [] };

  const filmById = Object.fromEntries(films.map((f) => [f.id, f]));
  const picksByBracket = {};
  (picks || []).forEach((p) => {
    (picksByBracket[p.bracket_id] ??= { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} })[p.round][p.slot] = filmById[p.film_id];
  });

  const playerById = Object.fromEntries((players || []).map((p) => [p.id, p]));

  return (brackets || [])
    .filter((b) => picksByBracket[b.id])
    .map((b) => {
      const player = playerById[b.player_id];
      const { total, champion, championAlive } = scoreBracket(films, picksByBracket[b.id]);
      return {
        playerId: b.player_id,
        name: player?.display_name || 'Unknown',
        isMe: b.player_id === session.user.id,
        total,
        champion,
        championAlive,
      };
    });
}

export async function renderStandings(session) {
  const listEl = document.getElementById('standingsList');
  const seasonEl = document.getElementById('stSeason');
  const countEl = document.getElementById('stCount');
  const sinceEl = document.getElementById('standingsSince');

  const season = await getCurrentSeason();
  if (!season) {
    listEl.innerHTML = '';
    countEl.textContent = '';
    sinceEl.textContent = 'No season is open yet.';
    return;
  }
  seasonEl.textContent = `${season.year} BOX OFFICE TOURNAMENT`;

  const films = await getSeasonFilms(season.id);
  const entries = await buildEntries(season, films, session);
  countEl.textContent = `${entries.length} PLAYER${entries.length === 1 ? '' : 'S'}`;

  const current = rankByPoints(entries);

  // movement: diff against the commissioner's last explicit "Update Standings"
  // snapshot (see commissioner.js commitStandings) — not inferred from film
  // release dates, which broke on films with fabricated placeholder dates.
  const { data: snapshotRows } = await supabase
    .from('standings_snapshot')
    .select('player_id, place, taken_at')
    .eq('season_id', season.id);

  let movementByPlayer = {};
  if (snapshotRows?.length) {
    const snapshotPlaceByPlayer = Object.fromEntries(snapshotRows.map((r) => [r.player_id, r.place]));
    movementByPlayer = Object.fromEntries(
      current.map((e) => [e.playerId, (snapshotPlaceByPlayer[e.playerId] ?? e.place) - e.place])
    );
    const d = new Date(snapshotRows[0].taken_at);
    sinceEl.textContent = `MOVEMENT SINCE LAST UPDATE · ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  } else {
    sinceEl.textContent = 'MOVEMENT SINCE LAST UPDATE';
  }

  listEl.innerHTML = current
    .map((e) => {
      const mv = movementByPlayer[e.playerId] || 0;
      const mvCls = mv > 0 ? 'up' : mv < 0 ? 'dn' : 'fl';
      const mvLabel = mv > 0 ? `▲&thinsp;${mv}` : mv < 0 ? `▼&thinsp;${Math.abs(mv)}` : '—';
      const medal = e.place <= 3 ? `medal g${e.place}` : '';
      const champText = e.champion ? e.champion.title : '—';
      return `<div class="rowwrap" data-player="${e.playerId}" data-name="${e.name.replace(/"/g, '&quot;')}">
        <span class="mvtab ${mvCls}">${mvLabel}</span>
        <div class="row ${e.isMe ? 'me' : ''}">
          <span class="pl ${medal}">${e.place}</span>
          <div class="mid"><div class="who">${e.name}</div></div>
          <div class="pts"><b>${e.total}</b><i>PTS</i></div>
          <div class="champ ${e.championAlive ? '' : 'dead'}">${champText}</div>
        </div>
      </div>`;
    })
    .join('');

  listEl.querySelectorAll('.rowwrap').forEach((row) => {
    row.addEventListener('click', () => {
      const playerId = row.dataset.player;
      const name = row.dataset.name;
      goTab('bracket');
      if (playerId === session.user.id) {
        renderBracket(session, name);
      } else {
        renderBracket(session, name, { playerId, playerName: name });
      }
    });
  });
}
