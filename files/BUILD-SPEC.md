# Box Office Bracket — Build Specification

A mobile web app for a year-long movie box office prediction tournament. Roughly 14 players,
one commissioner. Replaces a Google Sheets workflow.

This document is the source of truth. Where it conflicts with the prototypes, follow this document.

---

## 1. What the game is

64 films are chosen and seeded before the year starts, split into 4 brackets of 16.
Players fill in a single-elimination bracket predicting which film wins each matchup.

**A film's score is its opening weekend domestic (North American) gross**, recorded in millions
to two decimals (e.g. `$142.02M`). Box Office Mojo is the source. Once a film has a score it
keeps it for the whole tournament — later performance is irrelevant.

Films release throughout the year, so matchups resolve at unpredictable times. One release can
resolve several rounds at once in a chain reaction.

### Points

| Round | Matchups | Points each | Round total |
|---|---|---|---|
| Round 1 | 32 | 1 | 32 |
| Round 2 | 16 | 2 | 32 |
| Round 3 | 8 | 4 | 32 |
| Quarter-Finals | 4 | 8 | 32 |
| Semi-Finals | 2 | 16 | 32 |
| Championship | 1 | 32 | 32 |

Every round is worth exactly 32. A perfect bracket is **192**.

### The scoring rule that trips people up

A player scores for a matchup if **the film they placed in that slot is the actual winner of
that slot** — regardless of whether they got earlier rounds right. Getting Round 1 wrong does
not forfeit later rounds. The two films that actually met are irrelevant; only the winner matters.

---

## 2. Resolution rules — implement exactly

These are the rules most likely to be got wrong. Implement them as written.

### A matchup resolves when both sides have a score
Higher score advances. Not before.

### $0 films
A film scores `$0.00` if it is:
- **pushed** to a following year,
- **cancelled** outright, or
- released **straight to streaming** rather than theatrically.

A $0 film's score is **known immediately**, regardless of its original release date. It must not
sit showing "opens Nov 14" until that date passes.

The reason (`pushed` / `cancelled` / `streaming`) is displayed **only in the round where it
happened** — Round 1 in practice. Later rounds show the figure alone.

### Ties
The **only** way to tie is for both films to score $0.

When a matchup ties:
- Nobody scores it.
- **Neither film advances.** Both are eliminated.
- Any player who picked either film has that pick counted **wrong**.

### Empty slots are $0 competitors
A tie leaves the next round's slot empty. Treat an empty slot as a competitor scoring **$0**:

- The surviving film still has to post its own score and beat zero.
- If the survivor **hasn't released yet, the matchup does not resolve** — it could still be
  pushed or cancelled, which would make it another tie. Never award points that might be
  taken back.
- If the survivor scores **$0**, that is another tie and nobody advances.
- If **both** feeding matchups tied, the slot is itself a tie and the null propagates upward.

### Elimination
A film is eliminated **at the round where it lost or tied**. This matters for display: a film
that won Round 1 and lost Round 2 must appear normal in Round 1 and struck through from Round 2
onward. Do not mark a film as eliminated in rounds it actually won.

---

## 3. Data model

Nothing derived is stored. Standings, points, elimination and advancement are always computed
from films + scores + picks. This is what removes the commissioner's reconciliation work.

**seasons**
- `year` (int, unique)
- `state` — `setup` | `open` | `live` | `ended`
- `lock_date` (date, nullable) — after this, picks are no longer writable
- timestamps

**films**
- `id` (uuid) — **picks reference this, never the title**
- `season_id`
- `title` (text) — editable at any time without disturbing any bracket
- `bracket` (1–4)
- `seed` (1–16) — unique per (season, bracket)
- `release_date` (date)
- `score` (numeric, nullable) — opening weekend in millions
- `zero_reason` (nullable) — `pushed` | `cancelled` | `streaming`; when set, score is 0

**players**
- `id` (uuid)
- `email` (unique) — the identity thread across seasons
- `display_name`
- `is_commissioner` (bool)

**brackets**
- `id`, `season_id`, `player_id` (unique together)
- `submitted_at` (nullable)

**picks**
- `bracket_id`
- `round` (1–6)
- `slot` (0-indexed matchup within the round)
- `film_id`
- unique on (bracket_id, round, slot)

63 picks make a complete bracket: 32 + 16 + 8 + 4 + 2 + 1.

### Slot indexing
Round 1 slot `i` holds films at positions `i*2` and `i*2+1` in seed order.
Round `r` slot `i` is fed by round `r-1` slots `i*2` and `i*2+1`. Keep this convention
everywhere — the bracket layout maths depends on it.

Films are ordered within a season by bracket, then by the fixed seed order:
`1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15`

---

## 4. Permissions — enforce in the database, not the UI

Hiding a screen is not security. Every rule below must be a row-level policy.

1. **Only a commissioner may write** to `films` (scores, titles, dates, zero reasons) or change
   a season's `state`.
2. **A player may only write their own picks**, and only while the season is `open` and the
   lock date has not passed.
3. **Before a season is `live`, a player may read only their own bracket.** Once live, all
   brackets are readable by everyone. Otherwise someone could copy a rival's picks before
   submitting.
4. Everyone may read `films`, `seasons`, `players`.

---

## 5. Season lifecycle

Transitions are **commissioner button presses**, never dates. A film opening on 31 December has
no number until January, so a season must not end on a calendar boundary.

- **setup → open** — "Open for picks". Requires a valid 64-film import.
- **open → live** — "Launch tournament". Warn first, listing who hasn't submitted; their picks
  lock exactly as they stand. Brackets become publicly readable at this moment.
- **live → ended** — "End tournament". Manual. A completed season must stay on screen until the
  commissioner ends it, and remain readable forever afterward.

**More than one season may be `live` at once.** That is the changeover window: last year is still
being scored while this year has begun. The header's season line is a **switcher** listing every
season that is `live` or `ended`.

The `lock_date` is stored and enforced by the database independently of the buttons, so picks
stop being writable on time even if nobody presses anything.

---

## 6. Screens

### Login
Email only. No passwords. Magic link. A new email creates a profile; a returning email restores
that player's history. Not currently present in the prototype — must be built.

### My Bracket (default tab)
Shows **the player's own bracket**, not the master bracket. Round `r` matchup `i` pairs the
player's own winners from round `r-1` — so every pick they made stays visible, including ones
that are already dead.

- The player's pick is **always** the lit, larger half. The opponent is smaller and dimmer.
- Colour carries the outcome: **amber** = still live, **green** = correct, **red + strike** = dead.
- A film is struck through in every round from its elimination onward, on either side of a card.
- Strike-through takes the text's own colour. **Red is reserved for the player's own wrong picks**
  — an opponent knocked out by a correct pick stays neutral grey.
- Settled matchups get a points tab tucked behind the top-left of the card: green `4 PTS`, red
  `0 PTS`. Unresolved matchups have **no tab at all** — absence is the signal.
- Seeds are shown in Round 1 only.

### Standings
All players, ranked by total points. Ties share a place (two 1sts means no 2nd). Row shows place,
name, champion pick, total. Podium places get gold/silver/bronze discs. The player's own row is
highlighted. Tapping a row opens that player's bracket, with a back control.

A movement tab sits tucked behind the left edge of each row: `▲ 2`, `▼ 1`, `—`. Movement is
measured **since the last film opened**, not a calendar period — nothing changes on days without
a release. Label it accordingly.

### Tournament
A segmented toggle between two views of the same data:

- **Round by round** — the master bracket, swipe between rounds. No picks, no points. Neither
  side emphasised until a matchup settles, then the winner is lit green and the loser struck.
  A slot whose feeder hasn't resolved shows **TBD** with the latest release date among all films
  feeding it. A slot killed by a tie shows **Tie · $0.00M · NO ADVANCE** — show the null
  explicitly, or it reads as a rendering bug.
- **Full bracket** — the whole thing as a mirrored bracket, pan and pinch. Brackets 1 & 2 run
  left-to-right down the left, 3 & 4 right-to-left down the right, converging on the Championship
  in the centre. Zoom-out is capped at the point where the bracket fills the screen's short
  dimension (height in portrait, width in landscape); rotating resets to that fit.

### Profile
Reached by tapping the player's name pill in the header. History first: a row per season showing
place, year, champion pick, points. Podium finishes get 🏆 / 🥈 / 🥉 in place of the number.
A ⭐ under the name for each tournament won. Past seasons show the champion pick green if called
correctly, struck through if not. The live season shows a LIVE chip and no medal.

Viewing another player shows the same page minus the account section.

### Commissioner (commissioner only)
- **Scores** — all 64 films, sortable by release / rank / A–Z / score, with search. Tap a film to
  edit title, release date, opening weekend, and the never-released tags. Tagging a film forces
  its score to $0 and disables the score and date fields. Saving recomputes everything.
- **Seasons** — a card per season with its state and the single button that moves it forward,
  plus what's blocking it (submissions outstanding, films unscored).

### Fill Your Bracket
Appears as an extra tab only while a season is `open`. Tap a film in each matchup; later rounds
populate from the player's own winners. Swipe between rounds. Players may resubmit as often as
they like until the season launches. Submitting an incomplete bracket is refused with a list of
what's missing.

---

## 7. Bracket layout engine — reuse, don't reinvent

The prototypes contain a working solution to the hard part. Port it rather than rebuilding.

Each round's vertical spacing is exactly **double** the previous round's. So the whole plane is
described by one number — `focus`, the round currently sized to fit the screen:

```
pitch(r) = BASE * 2^(r - focus)
matchup i of round r is centred at (i + 0.5) * pitch(r)
```

Because pitch doubles, the midpoint between matchups `2j` and `2j+1` lands exactly on matchup `j`
of the next round. **Alignment is a property of the maths, not something to calculate.** `focus`
is continuous, so animating it makes the whole bracket breathe between rounds.

Other things that were hard-won and must be preserved:

- **One shared vertical scroll** across all six rounds, and one SVG spanning the whole plane so
  connector lines genuinely cross between columns. Six separate scroll containers do not work.
- **Horizontal paging is custom, not native.** A swipe must be clearly sideways (horizontal
  movement beating vertical by ~1.8×) and travel ~30% of the screen, or it's handed back to
  vertical scrolling. Otherwise angled swipes change rounds by accident.
- **Cards squash to fit** when a round's spacing is tighter than the card is tall (`scaleY`),
  which is what makes the round-to-round transition read correctly in both directions.
- **A ResizeObserver watches the cards**, because a title wrapping or a winner's type scaling up
  changes their height. Positions are applied as transforms, which don't affect measured height,
  so this can't feed back on itself.
- Vertical spacing must reserve room for the points tab and the bracket group label above a card.

---

## 8. Visual design

Locked. Follow the prototypes.

- Background `#08080B`, cards `#1A1A24`, borders `#343446`, seam `#3B3B52`
- Accent gold `#F0B54B`, cream `#FFF3DC`, body text `#D9D9E4`, dim `#8D8D9F`
- Green `#5FC97A`, red `#E0574A`
- Type: **Archivo** for everything, **IBM Plex Mono** for all numbers, dates and labels
- Cards have a subtle top highlight and drop shadow so they sit above the plane
- The winner's half is lit from below with a radial glow and takes larger, heavier type

Header pattern on every screen: a centred season line (tappable — it's the season switcher), then
a bar with the changing thing on the left and the fixed thing on the right.

**All text inputs must be ≥16px**, otherwise iOS zooms the page when they're focused.

---

## 9. Build order

1. Supabase project: tables, row-level policies, magic-link auth
2. Project structure, Supabase client, login screen
3. My Bracket reading real data — proves the whole data path
4. Standings, Tournament, Profile
5. Commissioner scores and seasons
6. Deploy to Vercel
7. Add the daily stay-awake workflow and the export (section 11)
8. Import this season's data (see below)
9. Invite players

## 10. Importing the current season

The 2026 season already exists in a spreadsheet and must be loaded in:

- **64 films** — paste four columns: `rank · bracket · title · release date`. Validate: exactly
  64 rows, every bracket holding ranks 1–16 exactly once, dates parseable and in the right year.
  Reject impossible dates rather than letting them roll over (`13/40/2027` must fail, not become
  2028).
- **Scores recorded so far** — via the commissioner scores screen.
- **14 existing brackets** — one player at a time. Paste a column of 63 film titles in slot order
  (Round 1 slots 0–31, then Round 2 slots 0–15, and so on). Validate each pick against the two
  films actually available in that slot for that player, and report the exact row of any mismatch.

## 11. Keeping it alive, and backups

Two operational requirements. Both are trivial to build now and painful to retrofit mid-season.

### Keep-alive
Supabase pauses free-tier projects after **7 days without activity**, and restoring one is a
manual step in their dashboard. A year-long tournament has genuinely quiet stretches — nothing
happens between releases — so this will otherwise take the app offline at some point.

Add a **GitHub Actions scheduled workflow that runs once a day** and makes one trivial query
against the database. Daily gives seven times the margin needed, so a failed run is harmless.
Free on public repositories.

Do not use a minute-interval uptime monitor. The requirement is activity within a week, not
constant polling.

### Export
Free-tier Supabase has **no automatic backups**, and the data represents real effort from
fourteen people. Provide a commissioner-only export that downloads the whole season — films,
scores, players, brackets and picks — as a single file that could be used to rebuild the season
from scratch. A JSON or CSV download is fine. It must be one button.

## 12. Out of scope for v1

Deliberately deferred: dues and payment tracking, payout handling, profile pictures/avatars,
notifications, and next-season setup beyond the film import.

---

## 13. Reference files

The prototypes are working implementations, not sketches. Use them as the starting point.

| File | What it demonstrates |
|---|---|
| `box-office-bracket-app.html` | The whole app assembled — all screens, shared engine, season switching |
| `live-bracket-prototype.html` | A player's bracket, mid-season and completed states |
| `master-bracket-prototype.html` | Master bracket with TBD and tie slots |
| `full-bracket-prototype.html` | Mirrored full bracket, pan and pinch |
| `standings-prototype.html` | Standings rows, movement tabs, medals |
| `profile-prototype.html` | Career history, medals, stars |
| `commissioner-prototype.html` | Score entry, tagging, sorting |
| `season-setup-prototype.html` | 64-film import with validation |
| `bracket-fill-prototype.html` | Filling and submitting a bracket |
