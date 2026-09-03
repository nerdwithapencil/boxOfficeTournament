import { supabase } from './supabaseClient.js';
import { sortFilms } from './resolve.js';

// The season My Bracket/Standings/Tournament/Commissioner Scores default to.
// Deliberately excludes 'open' — during the changeover window (spec section
// 5) a new season can be open for picks while last year is still live and
// being scored, and that new, empty season must not hijack these screens.
// 'open' seasons are only ever reached via Fill Your Bracket (getOpenSeason).
export async function getCurrentSeason() {
  const { data } = await supabase
    .from('seasons')
    .select('id, year, state')
    .in('state', ['live', 'ended'])
    .order('year', { ascending: false })
    .limit(1);
  return data?.[0] || null;
}

export async function getOpenSeason() {
  const { data } = await supabase
    .from('seasons')
    .select('id, year, state, commissioner_preview')
    .eq('state', 'open')
    .order('year', { ascending: false })
    .limit(1);
  return data?.[0] || null;
}

export async function getSeasonFilms(seasonId) {
  const { data } = await supabase
    .from('films')
    .select('id, title, bracket, seed, release_date, score, zero_reason')
    .eq('season_id', seasonId);
  return sortFilms(data || []);
}

export async function getAllSeasons() {
  const { data } = await supabase
    .from('seasons')
    .select('id, year, state, lock_date, is_historical, commissioner_preview')
    .order('year', { ascending: false });
  return data || [];
}
