# Movie catalog backlog

- Plug in the LLM annotation/review adapter once provider details are supplied:
  endpoint/API format, runtime authentication source, annotation and review model
  IDs, sampling/token settings, structured-output support, rate/cost limits,
  retention policy and sanitized errors/usage/request IDs. Implement the stdin/
  stdout contract in `llm_annotation.py`, version the profile, and qualify Telugu
  meanings, uncertainty and critical-review quality against existing curated
  reviews before activating bulk results. No live provider is configured yet.
- Use Bitwarden as the source of truth for TMDB/OMDb and future LLM credentials across development
  machines. Resolve secrets at runtime into the process environment; retain `.env`
  only as a local development fallback. Document vault item names, onboarding,
  rotation and recovery without storing tokens in Git or browser assets.
- Maintain released Telugu-original discovery from 2000 onward. Dated discovery
  also covers 1931–1939; extend native discovery through 1940–1999, then add
  undated films and reviewed Telugu dubs without duplicating source identities.
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
- Add a review workbench for unresolved identity matches and missing ratings;
  publish only approved prompts to games, with safe rendering and attribution.
- Add shared cross-machine provider quota tracking, retry scheduling and targeted
  discovery refresh; exhaust newly required nested provider endpoints only when
  existing snapshots cannot supply the feature.
