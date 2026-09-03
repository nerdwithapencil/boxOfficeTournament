-- Lets a season sit in 'open' state (picks writable) while staying hidden
-- from everyone but the commissioner in the Fill Your Bracket tab. Defaults
-- true so every "Open for picks" starts as a commissioner-only dry run; the
-- commissioner then presses "Make visible to everyone" in the Seasons admin
-- when it's actually ready. Purely a UI-visibility gate — RLS on
-- brackets/picks is unchanged, since the worst a player could do by reaching
-- the tab early is submit their own bracket a few days sooner.

alter table public.seasons
  add column if not exists commissioner_preview boolean not null default true;
