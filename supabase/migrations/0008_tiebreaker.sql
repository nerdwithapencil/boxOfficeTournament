-- Tie breaker: a per-season question (changes every year) with a single
-- numeric guess per player and one real answer once it's known. Reuses the
-- existing seasons/brackets tables rather than new ones, since both are
-- already one-row-per-season / one-row-per-player-per-season.

alter table public.seasons
  add column if not exists tiebreaker_question text,
  add column if not exists tiebreaker_answer numeric(10, 2);

alter table public.brackets
  add column if not exists tiebreaker_guess numeric(10, 2);
