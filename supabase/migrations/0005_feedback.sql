-- Player feedback — read only via the Supabase dashboard (Table Editor),
-- intentionally not exposed anywhere in the app itself. player_name is
-- captured at submit time so it's readable straight out of the table
-- without joining against players; player_id is kept for reference but
-- nullable so a deleted account doesn't take its feedback history with it.

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid references public.players (id) on delete set null,
  player_name text not null,
  message     text not null,
  created_at  timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback
  for insert with check (player_id = auth.uid());

-- deliberately no select/update/delete policy for any app role — this table
-- is meant to be read only via the Supabase dashboard directly.
