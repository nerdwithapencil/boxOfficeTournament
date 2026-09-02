-- Historical (pre-app) seasons: just a final result per player, no films/
-- brackets/picks. A real app-tracked season always reaches 'ended' with 64
-- films (it can't leave 'setup' otherwise), so "ended + is_historical" is an
-- unambiguous, permanent marker — never true for a season this app actually
-- ran.

alter table public.seasons add column if not exists is_historical boolean not null default false;

create table if not exists public.season_results (
  season_id      uuid not null references public.seasons (id) on delete cascade,
  player_id      uuid not null references public.players (id) on delete cascade,
  place          int not null check (place >= 1),
  points         int not null check (points >= 0),
  champion_title text,
  champion_hit   boolean,
  primary key (season_id, player_id)
);

alter table public.season_results enable row level security;

drop policy if exists season_results_select_all on public.season_results;
create policy season_results_select_all on public.season_results
  for select using (true);

drop policy if exists season_results_insert_commissioner on public.season_results;
create policy season_results_insert_commissioner on public.season_results
  for insert with check (public.is_commissioner());

drop policy if exists season_results_update_commissioner on public.season_results;
create policy season_results_update_commissioner on public.season_results
  for update using (public.is_commissioner()) with check (public.is_commissioner());

drop policy if exists season_results_delete_commissioner on public.season_results;
create policy season_results_delete_commissioner on public.season_results
  for delete using (public.is_commissioner());
