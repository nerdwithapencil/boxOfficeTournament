-- A dedicated table for the daily keep-alive ping (see .github/workflows/keepalive.yml).
-- Switching the ping from a read to a write, since Supabase's inactivity
-- detection appears not to count a plain SELECT as activity (a keep-alive
-- warning arrived despite the read-based ping running successfully every
-- day). RLS is enabled with no policies at all — completely locked down for
-- anon/authenticated; only the service_role key (which bypasses RLS) can
-- touch it, and the workflow uses exactly that key.

create table if not exists public.keepalive (
  id        int primary key default 1,
  pinged_at timestamptz not null default now(),
  constraint keepalive_singleton check (id = 1)
);

insert into public.keepalive (id, pinged_at) values (1, now())
on conflict (id) do nothing;

alter table public.keepalive enable row level security;
-- intentionally no policies — nobody but service_role can read or write this
