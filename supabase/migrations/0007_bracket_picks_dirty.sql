-- Tracks whether a bracket's picks have changed since it was last submitted,
-- so the Fill Your Bracket submit button can go gray-and-disabled ("nothing
-- to resubmit") vs gold-and-relabeled ("Re-Submit Changes") correctly even
-- after a reload. A plain in-memory flag would reset to "clean" on every
-- page load regardless of real state — the exact bug just fixed for the
-- commissioner's Update Standings button.

alter table public.brackets
  add column if not exists picks_dirty boolean not null default false;
