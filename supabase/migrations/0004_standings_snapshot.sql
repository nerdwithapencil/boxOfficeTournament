-- Standings movement tracking: replaces the old "guess it from release
-- dates" heuristic (which broke on films with fabricated placeholder dates,
-- like a pushed film with no real release date) with an actual recorded
-- event — a snapshot the commissioner takes explicitly after updating
-- scores. Movement is current rank vs. this snapshot, nothing inferred.

create table if not exists public.standings_snapshot (
  season_id uuid not null references public.seasons (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  place     int not null,
  points    int not null,
  taken_at  timestamptz not null default now(),
  primary key (season_id, player_id)
);

alter table public.standings_snapshot enable row level security;

drop policy if exists standings_snapshot_select_all on public.standings_snapshot;
create policy standings_snapshot_select_all on public.standings_snapshot
  for select using (true);

drop policy if exists standings_snapshot_insert_commissioner on public.standings_snapshot;
create policy standings_snapshot_insert_commissioner on public.standings_snapshot
  for insert with check (public.is_commissioner());

drop policy if exists standings_snapshot_update_commissioner on public.standings_snapshot;
create policy standings_snapshot_update_commissioner on public.standings_snapshot
  for update using (public.is_commissioner()) with check (public.is_commissioner());

drop policy if exists standings_snapshot_delete_commissioner on public.standings_snapshot;
create policy standings_snapshot_delete_commissioner on public.standings_snapshot
  for delete using (public.is_commissioner());
