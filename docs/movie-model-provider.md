# Compatible movie-model provider

Movie maintenance now uses the developer-only OpenAI-compatible Chat Completions
API by default. Browser games continue to read approved static movie files and
work offline; they never receive an API credential or call a model.

## Configure and run

Copy the `MOVIE_LLM_*` placeholders from `.env.example` into ignored `.env`, or
supply them through the existing process environment. Keep credentials local.
The supplied local base URL is `http://127.0.0.1:31415/v1`; the code appends
`/chat/completions`. The default model and judge IDs are `auto`, an advertised
route on that service. Explicitly configure different IDs when appropriate;
receipts retain the actual model ID reported by every response.

```sh
npm run movies:annotate:local -- --limit 1 --no-promote --verbose
# Existing maintenance schedules use this provider too:
python3 -m dev.movies.maintenance --help
```

Use an existing source catalog. Missing or empty catalogs fail before inference
or export, preventing an accidental empty public projection. To initialize an
isolated catalog from checked-in source records without network/provider calls:

```sh
python3 -m dev.movies.catalog --db dev/movies/.local/experiment/catalog.sqlite --export dev/movies/.local/experiment/export
python3 -m dev.movies.compatible_annotation --db dev/movies/.local/experiment/catalog.sqlite --export dev/movies/.local/experiment/export --limit 1 --no-promote --verbose
```

Use a private, isolated `--db` and `--export` for qualification. Omitting
`--no-promote` activates only complete, validated review approvals through the
existing promotion/source-fingerprint checks. Default production exports can
refresh the public movie projection, so use isolated paths for experiments.
There is no automatic switch to native Gemini on a compatible-provider failure.
Set `MOVIE_LLM_PROVIDER=gemini` explicitly to use the retained native path.
`--llm-daily-calls` is the maintenance flag; the old `--gemini-daily-calls` spelling
remains an accepted alias for existing schedules.

## Three candidates, then a judge

For each snapshot-bound input, three separate candidate slots start fresh
conversations. A candidate receives the source facts, exact output schema and
allowed evidence paths, without the other candidates. All three slots must
produce a valid annotation before judging starts. Invalid data is rejected,
never repaired into an accepted shape or substituted with a fabricated default.

A separate judge inference compares the three valid candidates, selects an
existing index and critically reviews that exact proposal. The selected index,
job identity and proposal SHA-256 must agree. The judge cannot rewrite scores or
smuggle extra fields into the selected result. A valid `revise`, `needs_human_review` or refusal to select prevents activation;
a rejection or confidence below 5 starts a fresh quality round with three new
candidates and another judgment. Confidence uses an explicit 1–10 scale; 5 is
accepted and any lower value is rejected. Models are told not to inflate their
confidence. Model agreement and model review do not claim human verification.

Every request asks for `response_format: json_schema` with `strict: true`, following
the [Chat Completions request contract](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create).
Request schemas also constrain string identities, evidence paths and eligible
proposal hashes where possible. Local validation remains authoritative even if a
compatible service ignores the schema request. It checks exact fields/types/enums, finite strict JSON without duplicate
keys, reachable evidence paths, stable movie/title/IDs, nullable unknowns with
reasons, gesture routes, review hashes and approvals without outstanding issues.
Refused, truncated, tool-call and non-text completions fail validation. The code
still computes the weighted final difficulty; the model never chooses it.

## Retry and performance limits

`MOVIE_LLM_MAX_ATTEMPTS=12` (or `--max-attempts`) applies independently to each
candidate slot and to the judge. Thus a prompt has at most 48 inference attempts
per quality round; the configured range is 1–50 per slot. A successful slot is
kept while another slot retries. Judge transport/contract failures retry against
the same three candidates. A valid rejection or confidence below 5 regenerates
all three candidates. `MOVIE_LLM_MAX_ROUNDS=12` bounds those quality rounds,
for a worst-case 576 attempts per prompt at the defaults, also subject to the
shared daily cap. Exhaustion publishes nothing and is reported as rejected.
`MOVIE_LLM_PARALLELISM=3` overlaps the three candidate requests using separate
SQLite connections and atomic quota reservations. Set 1 or 2 to reduce service
load; in-memory test catalogs retain sequential access. Only a complete set of
three successful candidate receipts can reach the judge.

Transport failures, gateway HTTP 400/408/429/5xx, invalid JSON and schema/domain
errors are recorded and retried within that limit. Authentication, configuration
and other terminal HTTP failures stop the run. Retry feedback names the failed
contract without injecting the raw malformed answer into the next prompt.
`MOVIE_LLM_RETRY_DELAY=1` gives exponential delays capped at 15 seconds.
`MOVIE_LLM_TIMEOUT=120` bounds each socket operation; `MOVIE_LLM_MAX_TOKENS=4096`
and a 1 MiB response limit bound output. No partial/truncated answer is accepted.

The shared daily ledger reserves the four minimum calls atomically before
claiming a job; every extra retry reserves another call before sending it.
A lower daily cap can stop a job before its attempt limit. Unused reservations
are conservative quota accounting, not a claim that inference was billed.
`--verbose` reports only model/stage/attempt progress, without prompts or secrets.

## Receipts, recovery and publication

Each attempt commits its intent before HTTP and retains its response, reported
model/usage, parsed output or validation/transport error in private
`llm_compatible_calls` rows and JSONL exports. The selected annotation and judge
review enter the existing `llm_calls` pipeline with links to those exact source
receipts. Promotion and subsequent annotation reads recheck all three distinct source
receipts, their quality round, the chosen exact proposal, judgment, and confidence
of at least 5 on the recorded 1–10 scale. Source identity/snapshot changes block
promotion; editorial precedence,
null final scores and `human_verified: false` remain intact.

Active-run retries after timeouts are authorized by this policy; an earlier
attempt may still have completed upstream. A process crash leaves an in-flight
job, which is never silently taken over. After stopping the old runner, use
`--recover-interrupted` explicitly. Exhausted/rejected jobs require `--retry`.
Changing endpoint/model/settings or the validation implementation changes job
identity. Credentials do not participate in that fingerprint.

HTTP redirects are refused rather than forwarding authorization. Plain HTTP is
accepted only on loopback; other endpoints require HTTPS. Credentials never
appear in profiles, command-line arguments, public assets or normal logs.
Provider error bodies stay in private receipts and are not echoed to logs;
reflected authorization and the configured credential are redacted before
persistence. Preserve the private database/exports; do not
commit them.

## Validation

`test/test_movie_compatible.py` exercises the real promotion/export path, a local
HTTP server, candidate and judge retry recovery, limits, malformed/truncated
outputs, invalid identity/evidence/hash bindings, secret handling and stale-source
rejection. The full original movie suite remains required. Live service
availability and answer quality need separate receipts and fresh-browser export
inspection; synthetic tests do not establish those results.

## Live qualification — 2026-10-29

A fresh isolated source catalog and live compatible-service calls collected three
valid Mayabazar (1957) proposals and an approving judge with confidence **9/10**.
The run retained **16 calls** over about **438 seconds**; the slowest slot needed
ten attempts, while the other successful slots were preserved. Invalid job IDs,
evidence paths, JSON and failed network calls were rejected. Three candidates
actually overlapped; judging began only when all three had passed. Provider
responses reported `gemini-3.5-flash-lite` and `gpt-5.6-luna`. These are reported
model identities, not human verification or measured accuracy.

An isolated copy passed the current promotion/export guards. Its real public
projection then passed new desktop Chromium/mobile WebKit contexts: year
filtering, hidden/revealed prompt, reload, rating explanations and attribution.
Production catalog/assets were not changed. All 100 movie tests pass, including
20 new provider cases. This qualifies one real integration case; the service
remains variable and broader score calibration stays in the movie backlog.
