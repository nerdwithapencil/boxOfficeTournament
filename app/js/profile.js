import { supabase } from './supabaseClient.js';
import { getCurrentSeason, getSeasonFilms } from './season.js';
import { buildEntries } from './standings.js';
import { rankByPoints } from './scoring.js';

// v1 shows only the current season (no season history yet — this app has
// only ever run one season). Future seasons will just accumulate more rows
// here once they exist, same shape as files/profile-prototype.html.
//
// `target` is optional — {playerId, playerName} to view someone else's
// profile (read-only: no edit-name/sign-out/commissioner controls), omit
// entirely to view your own.
export async function renderProfile(session, target) {
  const isOwn = !target || target.playerId === session.user.id;
  const targetId = target?.playerId || session.user.id;

  const whoEl = document.getElementById('who');
  const roleEl = document.getElementById('role');
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
  roleEl.textContent = player?.is_commissioner ? 'Commissioner' : 'Player';
  if (isOwn) commissionerLinks.style.display = player?.is_commissioner ? 'block' : 'none';

  const season = await getCurrentSeason();
  if (!season) return;

  const films = await getSeasonFilms(season.id);
  const entries = await buildEntries(season, films, session);
  const ranked = rankByPoints(entries);
  const entry = ranked.find((e) => e.playerId === targetId);
  if (!entry) return;

  const isLive = season.state !== 'ended';
  seasonsEl.innerHTML = `<div class="seasonrow ${isLive ? 'live' : ''}">
    <span class="pl">${entry.place}</span>
    <div class="mid"><div class="yrline">
      <span class="yr">${season.year}</span>
      <span class="champ ${entry.championAlive ? '' : 'dead'}">${entry.champion ? entry.champion.title : '—'}</span>
      ${isLive ? '<span class="livechip">LIVE</span>' : ''}
    </div></div>
    <div class="pts"><b>${entry.total}</b><i>PTS</i></div>
  </div>`;
}
