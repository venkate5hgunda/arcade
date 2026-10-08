# Movie catalog backlog

- Calibrate the configured Gemini Flash annotations and Pro reviews against
  Telugu-aware human reviews and player outcomes, including source-only titles,
  lexical ambiguity and audience familiarity. Keep uncertain final scores null.
- Use Bitwarden as the source of truth for TMDB/OMDb/Gemini credentials across development
  machines. Resolve secrets at runtime into the process environment; retain `.env`
  only as a local development fallback. Document vault item names, onboarding,
  rotation and recovery without storing tokens in Git or browser assets.
- Monitor daily all-years backfill and weekly provider refresh; add reviewed
  Telugu dubs originally cataloged in other languages without duplicating
  identities. Provider exhaustion is not a verified complete filmography.
- Review the 68 suspicious `1930` CSV records, transliteration variants, duplicate
  records, remake identity and source provenance/license before reconciliation.
- Resolve historical TMDB source matches that fail exact title/year/language or
  independent director/cast corroboration; preserve original fields and approve
  aliases explicitly instead of lowering match thresholds. The first complete
  search accepted 458 links; 1,919 supplied records still lack TMDB identities,
  including the 68 excluded suspicious years.
- Complete Telugu-aware title-by-title annotation. Calibrate familiarity and
  actability with player outcomes; preserve rubric versions and reason history.
- Resolve the nine explicitly uncertain familiarity estimates in the first
  native-ID-backed batch; continue reviewing prioritized cached identities.
- Resolve the `wikidata:review` queue (ambiguous title/year matches, TMDB
  disagreements, transliteration near-duplicates) and decide on Wikidata items
  with several articles. Consider Telugu Wikipedia (te.wikipedia) extracts for
  the 360 films without an English article, review the ~109 ±1-year
  transliteration candidates, and refresh pageviews periodically. Most English
  cast lists sit in column templates that plain-text extracts drop; parse the
  Cast section wikitext if Wikipedia cast becomes a primary source.
- Review TMDB/OMDb terms for publishing short overview snippets in public
  assets; keep per-record credits visible wherever summaries are shown.
- Add a review workbench for unresolved identity matches and missing ratings.
  Complete editorial or model-approved prompts already enter games automatically;
  human review is optional calibration, not a gameplay gate.
- Add shared cross-machine provider quota tracking and hosted scheduling if the
  local Mac cannot provide sufficient uptime; exhaust newly required nested provider endpoints only when
  existing snapshots cannot supply the feature.
