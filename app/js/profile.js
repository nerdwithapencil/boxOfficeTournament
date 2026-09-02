import { supabase } from './supabaseClient.js';
import { getAllSeasons, getSeasonFilms } from './season.js';
import { buildEntries } from './standings.js';
import { rankByPoints } from './scoring.js';

// One row per season this player has data for — real app-tracked seasons
// (live/ended, computed from films+picks) and pre-app historical seasons
// (is_historical, read directly from season_results) both flow through here
// so Profile shows one unified history list regardless of source.
async function getSeasonHistory(targetId) {
  const seasons = await getAllSeasons();
  const rows = [];

  for (const sn of seasons) {
    if (sn.is_historical) {
      const { data: r } = await supabase
        .from('season_results')
        .select('place, points, champion_title, champion_hit')
        .eq('season_id', sn.id)
        .eq('player_id', targetId)
        .maybeSingle();
      if (!r) continue;
      rows.push({
        year: sn.year,
        isLive: false,
        place: r.place,
        points: r.points,
        championTitle: r.champion_title,
        championHit: r.champion_hit,
      });
    } else {
      if (sn.state !== 'live' && sn.state !== 'ended') continue;
      const films = await getSeasonFilms(sn.id);
      const entries = await buildEntries(sn, films, { user: { id: targetId } });
      const ranked = rankByPoints(entries);
      const entry = ranked.find((e) => e.playerId === targetId);
      if (!entry) continue;
      const isLive = sn.state !== 'ended';
      rows.push({
        year: sn.year,
        isLive,
        place: entry.place,
        points: entry.total,
        championTitle: entry.champion?.title,
        championHit: isLive ? null : entry.championAlive,
      });
    }
  }
  return rows;
}

// `target` is optional — {playerId, playerName} to view someone else's
// profile (read-only: no edit-name/sign-out/commissioner controls), omit
// entirely to view your own.
export async function renderProfile(session, target) {
  const isOwn = !target || target.playerId === session.user.id;
  const targetId = target?.playerId || session.user.id;

  const whoEl = document.getElementById('who');
  const seasonsEl = document.getElementById('profileSeasons');
  const ticketsEl = document.getElementById('profileTickets');
  const accountSection = document.getElementById('profile-account-section');
  const commissionerLinks = document.getElementById('commissioner-links');

  accountSection.style.display = isOwn ? 'block' : 'none';
  seasonsEl.innerHTML = '';
  ticketsEl.textContent = '';

  const { data: player } = await supabase
    .from('players')
    .select('display_name, is_commissioner')
    .eq('id', targetId)
    .single();

  whoEl.textContent = player?.display_name ?? (isOwn ? '' : target.playerName);
  if (isOwn) commissionerLinks.style.display = player?.is_commissioner ? 'block' : 'none';

  const history = await getSeasonHistory(targetId);

  const wins = history.filter((h) => !h.isLive && h.place === 1).length;
  ticketsEl.textContent = '⭐'.repeat(wins);

  seasonsEl.innerHTML = history
    .map((h) => {
      const medal = h.isLive ? '' : { 1: '🏆', 2: '🥈', 3: '🥉' }[h.place] || '';
      const champClass = h.isLive || h.championHit == null ? '' : h.championHit ? 'hit' : 'miss';
      return `<div class="seasonrow ${h.isLive ? 'live' : ''}">
        <span class="pl ${medal ? 'medal' : ''}">${medal || h.place}</span>
        <div class="mid"><div class="yrline">
          <span class="yr">${h.year}</span>
          <span class="champ ${champClass}">${h.championTitle || '—'}</span>
          ${h.isLive ? '<span class="livechip">LIVE</span>' : ''}
        </div></div>
        <div class="pts"><b>${h.points}</b><i>PTS</i></div>
      </div>`;
    })
    .join('');
}
