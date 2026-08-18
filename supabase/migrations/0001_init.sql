-- Box Office Bracket — initial schema, RLS policies, and auth wiring.
-- Paste this whole file into the Supabase SQL Editor and run it once.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS throughout.

create extension if not exists pgcrypto;

-- =========================================================================
-- 1. TABLES
-- =========================================================================

create table if not exists public.seasons (
  id         uuid primary key default gen_random_uuid(),
  year       int not null unique,
  state      text not null default 'setup'
             check (state in ('setup', 'open', 'live', 'ended')),
  lock_date  date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- players.id IS the auth.users id — magic-link signup creates this row
-- automatically via the trigger below, so there's no separate signup step.
create table if not exists public.players (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text not null unique,
  display_name   text not null,
  is_commissioner boolean not null default false,
  created_at     timestamptz not null default now()
);

create table if not exists public.films (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid not null references public.seasons (id) on delete cascade,
  title       text not null,
  bracket     int not null check (bracket between 1 and 4),
  seed        int not null check (seed between 1 and 16),
  release_date date not null,
  score       numeric(6, 2) check (score is null or score >= 0),
  zero_reason text check (zero_reason in ('pushed', 'cancelled', 'streaming')),
  -- a film tagged with a reason must be scored exactly $0 — the app forces
  -- this, but it's cheap to guarantee at the DB level too.
  constraint films_zero_reason_implies_zero_score
    check (zero_reason is null or score = 0),
  unique (season_id, bracket, seed)
);

create table if not exists public.brackets (
  id           uuid primary key default gen_random_uuid(),
  season_id    uuid not null references public.seasons (id) on delete cascade,
  player_id    uuid not null references public.players (id) on delete cascade,
  submitted_at timestamptz,
  unique (season_id, player_id)
);

create table if not exists public.picks (
  id         uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references public.brackets (id) on delete cascade,
  round      int not null check (round between 1 and 6),
  slot       int not null check (slot >= 0),
  film_id    uuid not null references public.films (id) on delete cascade,
  -- slot range depends on round: R1 has 32 matchups (0-31) down to
  -- Championship's single matchup (slot 0). Keeps bad data impossible.
  constraint picks_slot_in_range check (
    (round = 1 and slot between 0 and 31) or
    (round = 2 and slot between 0 and 15) or
    (round = 3 and slot between 0 and 7)  or
    (round = 4 and slot between 0 and 3)  or
    (round = 5 and slot between 0 and 1)  or
    (round = 6 and slot = 0)
  ),
  unique (bracket_id, round, slot)
);

create index if not exists films_season_id_idx on public.films (season_id);
create index if not exists brackets_season_id_idx on public.brackets (season_id);
create index if not exists picks_bracket_id_idx on public.picks (bracket_id);

-- =========================================================================
-- 2. HELPER FUNCTIONS
-- =========================================================================

-- security definer so it bypasses RLS on players — otherwise a policy on
-- players that calls this would recurse into the players SELECT policy.
create or replace function public.is_commissioner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_commissioner from public.players where id = auth.uid()),
    false
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists seasons_set_updated_at on public.seasons;
create trigger seasons_set_updated_at
  before update on public.seasons
  for each row execute function public.set_updated_at();

-- Auto-create a players row the first time someone completes a magic-link
-- signup. This is what makes "new email creates a profile" work without a
-- separate signup screen.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.players (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Stops a player from writing is_commissioner = true on their own row via
-- the app (an authenticated PostgREST request, where auth.uid() is set).
-- Direct database sessions (dashboard SQL editor, migrations) have no
-- auth.uid() at all and are already trusted, so they're left alone —
-- otherwise this trigger blocks bootstrapping the very first commissioner.
create or replace function public.prevent_self_promotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.is_commissioner is distinct from old.is_commissioner
     and not public.is_commissioner() then
    new.is_commissioner := old.is_commissioner;
  end if;
  return new;
end;
$$;

drop trigger if exists players_guard_commissioner_flag on public.players;
create trigger players_guard_commissioner_flag
  before update on public.players
  for each row execute function public.prevent_self_promotion();

-- =========================================================================
-- 3. ROW LEVEL SECURITY
-- =========================================================================

alter table public.seasons  enable row level security;
alter table public.players  enable row level security;
alter table public.films    enable row level security;
alter table public.brackets enable row level security;
alter table public.picks    enable row level security;

-- ---- seasons: everyone reads, only commissioner writes -------------------
drop policy if exists seasons_select_all on public.seasons;
create policy seasons_select_all on public.seasons
  for select using (true);

drop policy if exists seasons_insert_commissioner on public.seasons;
create policy seasons_insert_commissioner on public.seasons
  for insert with check (public.is_commissioner());

drop policy if exists seasons_update_commissioner on public.seasons;
create policy seasons_update_commissioner on public.seasons
  for update using (public.is_commissioner()) with check (public.is_commissioner());

drop policy if exists seasons_delete_commissioner on public.seasons;
create policy seasons_delete_commissioner on public.seasons
  for delete using (public.is_commissioner());

-- ---- films: everyone reads, only commissioner writes ----------------------
drop policy if exists films_select_all on public.films;
create policy films_select_all on public.films
  for select using (true);

drop policy if exists films_insert_commissioner on public.films;
create policy films_insert_commissioner on public.films
  for insert with check (public.is_commissioner());

drop policy if exists films_update_commissioner on public.films;
create policy films_update_commissioner on public.films
  for update using (public.is_commissioner()) with check (public.is_commissioner());

drop policy if exists films_delete_commissioner on public.films;
create policy films_delete_commissioner on public.films
  for delete using (public.is_commissioner());

-- ---- players: everyone reads; players may only touch their own row,
--      commissioner may touch any row (is_commissioner flips are further
--      guarded by the trigger above) ----------------------------------------
drop policy if exists players_select_all on public.players;
create policy players_select_all on public.players
  for select using (true);

drop policy if exists players_update_self_or_commissioner on public.players;
create policy players_update_self_or_commissioner on public.players
  for update
  using (id = auth.uid() or public.is_commissioner())
  with check (id = auth.uid() or public.is_commissioner());

drop policy if exists players_delete_commissioner on public.players;
create policy players_delete_commissioner on public.players
  for delete using (public.is_commissioner());

-- no INSERT policy for players: rows are only ever created by the
-- handle_new_user trigger (security definer, bypasses RLS).

-- ---- brackets: owner always reads their own; everyone reads once the
--      season is live/ended (rule 3); owner writes only while open and
--      unlocked ------------------------------------------------------------
drop policy if exists brackets_select on public.brackets;
create policy brackets_select on public.brackets
  for select
  using (
    player_id = auth.uid()
    or public.is_commissioner()
    or exists (
      select 1 from public.seasons s
      where s.id = brackets.season_id and s.state in ('live', 'ended')
    )
  );

drop policy if exists brackets_insert_own_while_open on public.brackets;
create policy brackets_insert_own_while_open on public.brackets
  for insert
  with check (
    player_id = auth.uid()
    and exists (
      select 1 from public.seasons s
      where s.id = season_id
        and s.state = 'open'
        and (s.lock_date is null or s.lock_date >= current_date)
    )
  );

drop policy if exists brackets_update_own_while_open on public.brackets;
create policy brackets_update_own_while_open on public.brackets
  for update
  using (player_id = auth.uid())
  with check (
    player_id = auth.uid()
    and exists (
      select 1 from public.seasons s
      where s.id = season_id
        and s.state = 'open'
        and (s.lock_date is null or s.lock_date >= current_date)
    )
  );

-- ---- picks: same visibility rule as brackets, via the parent bracket;
--      writes only to your own bracket while its season is open/unlocked --
drop policy if exists picks_select on public.picks;
create policy picks_select on public.picks
  for select
  using (
    public.is_commissioner()
    or exists (
      select 1 from public.brackets b
      where b.id = picks.bracket_id and b.player_id = auth.uid()
    )
    or exists (
      select 1 from public.brackets b
      join public.seasons s on s.id = b.season_id
      where b.id = picks.bracket_id and s.state in ('live', 'ended')
    )
  );

drop policy if exists picks_insert_own_while_open on public.picks;
create policy picks_insert_own_while_open on public.picks
  for insert
  with check (
    exists (
      select 1 from public.brackets b
      join public.seasons s on s.id = b.season_id
      where b.id = bracket_id
        and b.player_id = auth.uid()
        and s.state = 'open'
        and (s.lock_date is null or s.lock_date >= current_date)
    )
  );

drop policy if exists picks_update_own_while_open on public.picks;
create policy picks_update_own_while_open on public.picks
  for update
  using (
    exists (
      select 1 from public.brackets b
      where b.id = picks.bracket_id and b.player_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.brackets b
      join public.seasons s on s.id = b.season_id
      where b.id = bracket_id
        and b.player_id = auth.uid()
        and s.state = 'open'
        and (s.lock_date is null or s.lock_date >= current_date)
    )
  );

drop policy if exists picks_delete_own_while_open on public.picks;
create policy picks_delete_own_while_open on public.picks
  for delete
  using (
    exists (
      select 1 from public.brackets b
      join public.seasons s on s.id = b.season_id
      where b.id = bracket_id
        and b.player_id = auth.uid()
        and s.state = 'open'
        and (s.lock_date is null or s.lock_date >= current_date)
    )
  );
