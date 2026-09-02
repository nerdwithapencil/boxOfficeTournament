import { supabase } from './supabaseClient.js';
import { sortFilms } from './resolve.js';

export async function getCurrentSeason() {
  const { data } = await supabase
    .from('seasons')
    .select('id, year, state')
    .in('state', ['open', 'live', 'ended'])
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
    .select('id, year, state, lock_date, is_historical')
    .order('year', { ascending: false });
  return data || [];
}
