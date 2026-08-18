import { supabase } from './supabaseClient.js';
import { getCurrentSeason, getSeasonFilms } from './season.js';
import { scoreBracket, rankByPoints } from './scoring.js';
import { goTab } from './nav.js';
import { renderBracket } from './bracket.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function lastOpenedFilm(films) {
  return films
    .filter((f) => f.score != null)
    .reduce((latest, f) => (!latest || f.release_date > latest.release_date ? f : latest), null);
}

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

  // movement: re-score with the most-recently-opened scored film(s) blanked out
  const lastFilm = lastOpenedFilm(films);
  let movementByPlayer = {};
  if (lastFilm) {
    const prevFilms = films.map((f) =>
      f.release_date.getTime() === lastFilm.release_date.getTime() ? { ...f, score: null } : f
    );
    const prevEntries = await buildEntries(season, prevFilms, session);
    const prev = rankByPoints(prevEntries);
    const prevPlaceByPlayer = Object.fromEntries(prev.map((e) => [e.playerId, e.place]));
    movementByPlayer = Object.fromEntries(
      current.map((e) => [e.playerId, (prevPlaceByPlayer[e.playerId] ?? e.place) - e.place])
    );
    sinceEl.textContent = `MOVEMENT SINCE ${lastFilm.title.toUpperCase()} OPENED · ${MONTHS[lastFilm.release_date.getMonth()]} ${lastFilm.release_date.getDate()}`;
  } else {
    sinceEl.textContent = 'NO FILMS HAVE OPENED YET';
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
