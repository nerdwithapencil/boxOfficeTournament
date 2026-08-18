import { getCurrentSeason, getSeasonFilms } from './season.js';
import { buildEntries } from './standings.js';
import { rankByPoints } from './scoring.js';

// v1 shows only the current season (no season history yet — this app has
// only ever run one season). Future seasons will just accumulate more rows
// here once they exist, same shape as files/profile-prototype.html.
export async function renderProfile(session) {
  const seasonsEl = document.getElementById('profileSeasons');
  const ticketsEl = document.getElementById('profileTickets');
  seasonsEl.innerHTML = '';
  ticketsEl.textContent = '';

  const season = await getCurrentSeason();
  if (!season) return;

  const films = await getSeasonFilms(season.id);
  const entries = await buildEntries(season, films, session);
  const ranked = rankByPoints(entries);
  const mine = ranked.find((e) => e.playerId === session.user.id);
  if (!mine) return;

  const isLive = season.state !== 'ended';
  seasonsEl.innerHTML = `<div class="row ${isLive ? 'live' : ''}">
    <span class="pl">${mine.place}</span>
    <div class="mid"><div class="yrline">
      <span class="yr">${season.year}</span>
      <span class="champ ${mine.championAlive ? '' : 'dead'}">${mine.champion ? mine.champion.title : '—'}</span>
      ${isLive ? '<span class="livechip">LIVE</span>' : ''}
    </div></div>
    <div class="pts"><b>${mine.total}</b><i>PTS</i></div>
  </div>`;
}
