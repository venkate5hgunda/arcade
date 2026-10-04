# Movie system of record

The authoritative local store is `dev/movies/.local/movies.sqlite` (SQLite schema v1).
The provided CSV remains unchanged; its exact bytes, hash, headers and every
record's original fields are also stored. New source columns survive ingestion.
JSONL exports retain source records, identity/match evidence, full raw provider
responses, coverage receipts and all annotation revisions. Neither credentials
nor request URLs containing credentials are stored in the database.

## Run

Use Python 3.9+; no packages or database server are required.

```sh
npm run movies:build
# OMDb title/year hydration, modern starter films first, then newest historical films:
python3 -m dev.movies --omdb --max-calls 100
# TMDB discovery of released Telugu-original films since 2000 plus rich hydration:
python3 -m dev.movies --tmdb --max-calls 100
# Corroborate and hydrate existing historical source rows without creating duplicate movies:
python3 -m dev.movies --tmdb-sources --max-calls 500
# Earlier decades can be discovered independently:
python3 -m dev.movies --tmdb --start-year 1931 --end-year 1999
npm run test:movies
```

Set `OMDB_API_KEY` and/or `TMDB_API_KEY` in `.env`. They are **different services**:
an OMDb key will not authenticate with TMDB. TMDB accepts its v3 API key or its
read-access bearer token. `TMDB_READ_TOKEN` is used when `TMDB_API_KEY` is empty.
Environment variables take precedence over `.env`.
Do not paste credentials into chat or commit `.env`. Use `npm start`, which
blocks private files; generic static servers can expose `.env` and the database.
The development server binds localhost. Game content is unchanged: catalog
exports are intentionally not exposed to the browser until reviewed for play.

## Persistence and progressive coverage

Each canonical request is cached indefinitely. A rerun replays cached responses
without a live call; exact known OMDb identities are not hydrated again.
`--refresh` explicitly creates new snapshots without deleting old ones.
Not-found responses are cached; quota/auth/network errors halt that provider
and are not mistaken for a completed movie. A request budget exhaustion exits
nonzero, but all completed work is retained and exported. Rerun to resume.
Respect your account's daily limits (OMDb free plans typically permit 1,000
requests/day). A persistent 950-request UTC-day safety ceiling leaves headroom,
but cannot account for calls made by other apps/machines with the same key.
Requests for independent TMDB details run in batches of up to eight; database
writes stay on the owner thread.
Identical requests within a batch share one live request and response receipt.
OMDb's per-record `Error getting data.` response is logged and retained as an
auditable `provider_error`; other records can proceed. These records are skipped
on ordinary reruns and retried only with explicit `--refresh`.

TMDB discovers by primary release date, one calendar month at a time, paging all
results. There is no popularity floor. Adult/video entries are preserved for
completeness, not implicitly approved for gameplay. Completed shards are hydrated
before advancing. Full movie details append credits, alternative titles,
translations, keywords, release dates, external IDs, images, videos,
recommendations and similar titles. Appended endpoints can have their own
pagination; the stored response is lossless, not a claim that every provider
endpoint or nested page has been exhausted. A future feature can project any
cached field locally; only genuinely uncached endpoints require new calls.

`coverage` records dated, completed scopes with response IDs and counts.
The catalog is **not** claimed to be a complete filmography: TMDB omissions,
undated films, Telugu dubs originally in another language and future releases
need separate strategies. Refresh discovery explicitly to pick up late additions.
OMDb can enrich named titles/IMDb IDs, but cannot enumerate all Telugu releases.

CSV identities use source hash + record ordinal: apparent duplicates are retained
until reviewed, not collapsed by title. A corrected CSV is a new source version,
not an overwrite. Seed/discovery titles merge only with a unique exact normalized
title/year match or explicitly reviewed same-year aliases. Reconciled seed
records retain their original identity in `redirects` and transfer receipts and
annotation history to the canonical record. OMDb linking requires exact normalized title, exact year,
Telugu language and movie type; discrepancies and collisions are queued in
`matches` as `needs_review`. Source values are never overwritten by provider
values. OMDb hydration uses the IMDb ID from TMDB details where available.
Known historical OMDb identities crosswalk to TMDB through `/find`, requiring
a unique Telugu-original movie with the same year. Transliteration aliases and
remakes need explicit reviewed reconciliation.
`--tmdb-sources` searches unlinked source records by exact normalized title and
primary release year. A unique Telugu-original candidate must also have an
exact independently corroborated director name; when director evidence is
unavailable, an exact cast name can corroborate it. Name-token order and
punctuation are normalized, but initials are not expanded and near spellings
are not guessed. Contradicting director evidence is not overridden by matching
cast. Identity collisions remain review-required. All search/detail snapshots
are cached, and linked records are skipped on ordinary reruns.
The source's 68 records marked `1930` are suspicious (Telugu feature film history
starts later); these are flagged and excluded from automatic hydration.
Year-only release dates remain year-only. Unknown values remain unknown.

### Published progress: 4 October 2026

The local catalog contains 5,053 records, including all 2,407 supplied source
rows unchanged. TMDB has 3,134 linked, fully hydrated identities; OMDb has 776.
The cache retains 7,108 raw responses. Dated TMDB discovery has exhausted 430
monthly intervals: 1931–1939 and January 2000 through 4 October 2026. The early
decade added ten native records, without rewriting the suspicious source years.

Historical search examined all 2,309 eligible, initially unlinked source rows
and accepted 458 independently corroborated identities. The remaining 1,919
source records without a TMDB link include the 68 excluded suspicious years;
unmatched titles, contradictory credits and collisions remain unresolved.
Replaying historical search and early-decade discovery required zero live calls.
These are completed search scopes, not claims that every source film exists in
TMDB or that the catalog is an exhaustive filmography.

There are 159 complete editorial difficulty ratings and 4,894 records without
a final score, including nine reviews with unresolved familiarity. OMDb remains
paused at its persistent daily safety ceiling.

## Difficulty rubric: `charades-v1`

Audience: Telugu-film-aware casual adult players. Rules: no speaking, mouthing,
writing or spelling letters. Scale: **1 easy, 2 approachable, 3 moderate,
4 hard, 5 very hard**.

- **Actability (50%)**: 1 concrete, distinctive gesture; 2 gesture sequence;
  3 abstract/mixed or character-dependent cues; 4 acronym/proper-name or
  non-unique film-scene cues; 5 no reliable nonverbal route.
- **Recognition (30%)**: 1 broadly familiar to the target audience; 2 commonly
  familiar; 3 mixed familiarity; 4 niche; 5 obscure. Provider popularity/vote
  counts are proxies, not audience measurements, and absent data is not obscurity.
- **Title complexity (20%)**: token count: 1 for <=2 tokens, 2 for 3–4,
  4 for 5–6, 5 for >=7. This mechanical length measure deliberately does not
  pretend to understand Telugu semantics or transliteration.

Final rating is the weighted sum rounded half up to 1–5, **only when all three
components have evidence**. Unreviewed dimensions remain null and yield an
uncertainty interval, not an invented neutral score. Every component carries
its value, weight, method and reasoning. Overall annotations include audience,
confidence, source, rubric version and review status, with immutable history.
Editorial familiarity estimates are explicitly hypotheses requiring calibration.
The annotation's `prompt_title` identifies the reviewed display title; provider
aliases with longer subtitles do not silently change its title-length score.

`editorial/annotations.json` provides 168 title-specific editorial reviews,
including Eega, Baahubali: The Beginning, Pushpa: The Rise and RRR. They distinguish
literal gestures from scene familiarity, and installment ambiguity from title
length. They are **not** a comprehensive human review of the historical CSV.
The additional 100 reviews bind to exact native TMDB IDs and cite cached
snapshot metrics, credits and title evidence. Of these, 91 provide both
dimensions; nine explicitly leave familiarity unresolved rather than inferring
it from global votes. Incomplete dimensions remain null with a bounded range.
Curatorial receipt IDs refer to the original snapshot database, not arbitrary
IDs on another development machine. Available local snapshots are verified by
native path and fetch timestamp and include request/body hashes.
All other titles are honestly marked `needs_review`; their final score is withheld.
A Telugu-aware reviewer must inspect meanings, aliases and audience familiarity
before these enter difficulty-filtered gameplay. Changes to this file append
new annotation revisions on the next build; provider metadata never silently
replaces editorial reasoning.

## Attribution and usage

This product uses the TMDB API but is not endorsed or certified by TMDB.
Before publishing a TMDB-powered UI, include TMDB's approved logo and attribution
and review its API terms: https://developer.themoviedb.org/docs/faq.
OMDb: https://www.omdbapi.com/ (review plan, usage and redistribution terms).
Keep the imported CSV's provenance/license under review before redistribution.
Raw third-party metadata is retained locally, not copied into the public game.

## Exported movie shape

`movies.jsonl` contains identity fields (`id`, `title`, `year`, `language`,
`created_at`), original `source_rows`, provider `identities` with parsed
`evidence`, match receipts, annotation history (including IDs, timestamps and
input hashes), and `provider_data`. Each provider-data entry contains its latest
trusted full payload, response ID, fetch timestamp and HTTP status. Unresolved
candidate matches never become trusted provider data. The separate
`responses.jsonl` retains every raw snapshot, including candidates and errors.
`manifest.json` includes pending/reviewed annotation counts and discovery scopes.
It also records linked movie counts per provider, each provider's latest run
status, live-call count and stopping reason. OMDb quota-limited hydration remains
explicitly partial even when a later offline rebuild succeeds.

## Directory ownership

`catalog.py` contains the coupled ingestion, identity, cache and annotation flow;
`__main__.py` is the module entry point. `sources/` preserves supplied inputs,
`editorial/` holds versioned review definitions, and `.local/` holds the private
SQLite system of record and regenerable `export/` snapshots. Do not commit
`.local/` or credentials. The source schema and original CSV bytes are unchanged
by directory organization.
