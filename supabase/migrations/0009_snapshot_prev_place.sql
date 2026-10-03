-- Standings movement = how each rank changed between the previous
-- "Update Standings" and this one. The snapshot used to hold only the new
-- places, so right after any commit everyone compared equal to themselves
-- and every badge read zero. prev_place keeps the baseline that was in
-- effect just before the commit overwrote it.

alter table public.standings_snapshot
  add column if not exists prev_place int;
