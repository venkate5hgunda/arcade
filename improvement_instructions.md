# CLAUDE :: Arcade Repository Review

Prepared for Venkatesh · Repository: github.com/venkate5hgunda/arcade

> **Scope note:** GitHub returned 503 errors for `ARCHITECTURE.md` and `package.json` and blocked automated access to the `js/` and `games/` directories. This review is based on the repository front page and README only. No source code was read, so it covers design and structure as described. A line-level review needs the files listed at the end.

## What looks strong

- **Zero build step, one module per game.** The `GAMES` catalog and the `games/<id>.js` contract (`render(el, game)`) keep the surface small.
- **Offline-first with a vendored QR decoder.** No external runtime dependencies is a real strength for a PWA.
- **Documentation.** `ARCHITECTURE.md`, `BUSINESS_RULES.md` and `CHANGELOG.md` are rare for a hobby project and make maintenance easier.
- **Host-authoritative rooms and a guarded local dev server.** Blocking `.env` and `dev/` data in the local server is a good guard.

## Risks and recommendations

### 1. Adding a game has too many manual steps

The "Adding a new game" section requires edits in three places: `game-catalog.js`, `sw.js` (`STATIC_ASSETS` plus a cache version bump), and `game-session.js` (resume window). The README also lists inactivity windows twice, which will drift.

- Put the resume window, player range and category in the catalog entry, and have `game-session.js` read from it.
- Generate `STATIC_ASSETS` and the cache version in a small script (`npm run build:sw`) that hashes the files. A forgotten version bump leaves users on stale code offline, which is hard to debug.
- Generate the README game table and the resume-window list from the catalog.

### 2. Service worker cache invalidation

Manual cache-version bumps are the most common PWA bug.

- Derive the version from a content hash.
- Use stale-while-revalidate for the shell and cache-first for versioned assets.
- Show an "Update available, reload" prompt rather than silently swapping code mid-game, which matters given the resume-after-refresh feature.
- Delete old caches in the `activate` handler.

### 3. Persistence and schema versioning

A lot is persisted in `localStorage`: settings, scores, per-game checkpoints and host room checkpoints.

- Wrap every key in a versioned envelope (`{v: 2, savedAt, data}`) and add migrations. Without this, a change to a game's state shape will break resume for existing users or crash on load.
- Validate on load and discard corrupt data instead of throwing.
- Handle `QuotaExceededError` and Safari private mode, where writes can fail.
- Consider IndexedDB for large checkpoints (Business and Island Charter state).

### 4. State management inside games

Business and Island Charter are the highest-risk modules. A common pattern in no-build vanilla apps is state, rules and DOM rendering interleaved in one large file.

- Split each complex game into pure `rules` (state + action → new state) and a `view`. Rules with no DOM access can be unit tested and reused as the host-authoritative reducer in rooms.
- Use one action/reducer shape for local and remote play, so the same code path runs whether the action came from a tap or a WebRTC message.
- Seed all randomness (dice, shuffles, board generation) so bugs reproduce and tests are deterministic.

### 5. Multiplayer security and robustness

Host-authoritative is the right model; the details matter.

- Validate every guest message on the host: schema, sender seat, whose turn it is, and legality of the action. Never trust guest-supplied state.
- Add a protocol version to the handshake so mismatched cached clients fail clearly.
- Use a cryptographically secure shuffle (`crypto.getRandomValues`) for card decks held by the host, and be explicit about the host-trust limits.
- Set message size limits and ignore unknown message types.
- Invite links carry SDP in the URL. Confirm they use the fragment (`#`) rather than the query string, so they don't reach server logs or referrers.
- Consider an optional tiny signaling relay or TURN config via `.env` for networks where WebRTC fails.

### 6. Testing

The biggest correctness risk is rules logic.

- Prioritize tests for pure rules: Chess legality, Business bankruptcy and mortgage edge cases, Ludo captures, UNO challenge rules, Island Charter distance and road rules.
- Add property or fuzz tests: random legal-move playouts that never produce an invalid state.
- Add a Playwright smoke test that loads every catalog entry and checks for console errors.
- Run `npm test` in `.github` CI on every push, along with linting.

### 7. Tooling without a build step

- Add ESLint and Prettier (config only, no bundler needed).
- Add JSDoc types plus `// @ts-check` or a `tsconfig` with `checkJs`. This gives most of TypeScript's safety for state objects with no build.
- Pin and document the Node/Python versions used by `dev/` scripts.

### 8. Performance and UX

- Lazy-load game modules with dynamic `import()` per route. The service worker can still precache them, but first load stays small.
- Physics (Pool, Air Hockey): keep the fixed-step simulation decoupled from rendering, pause on `visibilitychange`, and cap catch-up steps to avoid a spiral after a tab is backgrounded.
- Accessibility: keyboard-playable controls, `aria-live` regions for turn changes, and a non-color cue for the colorblock Island Charter mode.
- Keep sounds and haptics behind feature detection, as already documented.

### 9. Repository hygiene

- Confirm `dev/` is not deployed and that provider API keys never appear in committed history (run `gitleaks` once).
- Note the licensing on the movie data: TMDB and OMDb terms differ from MIT, and CC BY-SA from Wikipedia has share-alike implications. Keep attribution in-app and in a `THIRD_PARTY.md`.
- The README mixes user docs with changelog-style rule details. Move per-game rules into `docs/games/<id>.md` and keep the README to overview, run, and add-a-game.
- Add a `CONTRIBUTING.md` and a PR template under `.github` as the catalog grows.

## Suggested order of work

1. Generate `sw.js` assets and version, and add storage versioning (prevents user-facing breakage).
2. Add message validation in the multiplayer host (prevents cheating and crashes).
3. Pull rules out of Business, Island Charter and Chess into pure modules, and add tests.
4. Add lint, `checkJs`, and CI.
5. Make the README and config catalog-driven.

## Files needed for a line-level review

`ARCHITECTURE.md`, `sw.js`, `js/storage.js`, `js/multiplayer.js`, and one large game such as `games/business.js`.



# COPILOT :: Code review: Arcade

Repository: [venkate5hgunda/arcade](https://github.com/venkate5hgunda/arcade) · Branch: `main` · Review date: October 10, 2026

## Overall assessment

Arcade is a substantial vanilla JavaScript progressive web app, not just a collection of simple games. It combines a browser-based game catalog, offline support, local game-state recovery, synthesized audio, touch feedback, a multiplayer WebRTC protocol, and a Python-based Telugu movie catalog pipeline.

My overall recommendation is to preserve the lightweight architecture while tightening correctness, state validation, automated checks, and module boundaries. A framework migration or broad rewrite would add complexity without addressing the most important risks.

## Review summary

Strong foundations

Native ES modules, independently implemented game modules, reusable physics and dice engines, documented state-recovery behavior, and focused Node.js/Python test suites.

Highest-priority corrections

Narrow service-worker cache cleanup, ensure module-loading failures reach the error UI, strengthen nested multiplayer checkpoint validation, and make persistence failures visible.

Best long-term improvements

Break up oversized modules, eliminate manually maintained integration lists where possible, automate regression testing, and bring the README and architecture reference into sync with the implementation.

This is a source-and-test review of the current GitHub code. I have not run the application across real browsers or devices, so the findings below distinguish code-level defects and design risks from behavior that still needs runtime verification.

## 1. Prioritized findings

P1 = address before expanding dependent functionality; P2 = important reliability or maintainability improvement; P3 = worthwhile cleanup.

1\. Service-worker cleanup deletes unrelated caches

P1

File: [sw.js](https://github.com/venkate5hgunda/arcade/blob/main/sw.js) · `activate` handler

The activation handler deletes every cache whose name is not exactly the current static or runtime cache:

```
keys.filter(
  k => k !== STATIC_CACHE && k !== RUNTIME_CACHE
).map(k => caches.delete(k))
```

Cache Storage belongs to the entire browser origin, not just this application. If another app or component on the same origin maintains its own cache, an Arcade service-worker activation can delete it.

Recommended change: scope cleanup to Arcade's cache namespace and preserve unknown caches.

```
const CACHE_PREFIX = 'arcade:';

const activeCaches = new Set([
  STATIC_CACHE,
  RUNTIME_CACHE,
]);

const staleArcadeCaches = keys.filter(
  key =>
    key.startsWith(CACHE_PREFIX) &&
    !activeCaches.has(key)
);

await Promise.all(
  staleArcadeCaches.map(key => caches.delete(key))
);
```

Keep this cleanup logic inside the activation event's existing `waitUntil` flow.

Regression test: seed Cache Storage with an old Arcade cache and an unrelated cache such as `other-app:v1`. After activation, the old Arcade cache should be gone and the unrelated cache should remain.

This is especially important if the app is deployed under a shared origin or expanded into a larger web application.

2\. Game import failures are misreported as missing games

P1

Files: [game-catalog.js](https://github.com/venkate5hgunda/arcade/blob/main/js/game-catalog.js), [router.js](https://github.com/venkate5hgunda/arcade/blob/main/js/router.js)

`loadGameModule()` catches every exception from `import()` and returns `null`. The router interprets `null` as a missing implementation and renders a “Coming soon” page.

That makes very different failures look identical: a genuinely missing module, a syntax error, a broken import dependency, or an exception while initializing a module.

The repository's architecture document already recognizes this as a confirmed diagnostic defect.

Recommended change: distinguish an intentionally unavailable game from an unexpected loading failure. Since the current catalog appears to register implemented games, an import failure should normally be an error, not a “Coming soon” state.

A simple starting point is to let unexpected import errors propagate:

```
export async function loadGameModule(id) {
  const game = getGame(id);
  if (!game) return null;

  const mod = await import(`../games/${id}.js`);
  return mod.default ?? mod;
}
```

Then add error handling around the import itself in `navigate()`. Currently, its `try/catch` handles `module.render()` failures but is positioned after the import.

If planned games are introduced later, represent their status explicitly in the catalog rather than inferring it from a failed network or module operation.

Regression tests: simulate a missing implementation separately from a module that throws during evaluation. The first should show the intentional unavailable state; the second should expose an actionable error and preserve the original exception for debugging.

3\. Mafia's checkpoint validator is not sufficiently strict

P1

File: [mafia-engine.js](https://github.com/venkate5hgunda/arcade/blob/main/games/mafia-engine.js) · `validMafia()`

The Mafia engine follows a good design principle: the host owns the full state, and `viewFor()` constructs each player's restricted view. However, `validMafia()` checks mainly the outer shape of the checkpoint.

For example, it accepts `actions` and `clues` as objects without explicitly rejecting arrays. It does not validate action keys as seat indexes or validate the values and structure of skipped seats and detective clues.

That matters because `games/mafia.js` uses this validator when restoring the host's saved game, and the repository explicitly treats persisted state as untrusted input.

A malformed checkpoint could pass the validator and then produce inconsistent game rules, invalid targets, or rendering failures. This is a robustness issue, not evidence that an ordinary guest can bypass the room protocol.

Recommended change: strengthen validation at the engine boundary.

- Require plain object shapes for state maps and reject arrays.
- Validate every action key as an integer seat within the player count.
- Validate target values according to the current phase and action type.
- Require unique, in-range integers in `skipped`, with no incompatible overlap with submitted actions.
- Validate clue entries, including day, target seat, and Boolean investigation result.
- Check phase/winner consistency and reject impossible state combinations.

Add focused tests in [mafia.test.js](https://github.com/venkate5hgunda/arcade/blob/main/test/mafia.test.js) for malformed nested checkpoints. The current suite exercises game actions and private views well, but does not import `validMafia()` directly.

Important boundary: keep validation in the engine rather than only in the DOM renderer. It should protect restored state and any future callers equally.

4\. Persistence failures do not consistently reach the player

P2

Files: [storage.js](https://github.com/venkate5hgunda/arcade/blob/main/js/storage.js), [game-session.js](https://github.com/venkate5hgunda/arcade/blob/main/js/game-session.js)

`saveJSON()` returns `false` when `localStorage` is unavailable or a write fails. Some callers log warnings, while others ignore that return value. In particular, `createGameSession().finish()` and some cleanup paths do not consistently report failed writes or removals.

For an app whose advertised features include resuming unfinished games, silent failure can create a mismatch between what a player expects and what will actually survive a refresh.

Recommended change: define a consistent storage-health contract.

1. Keep the low-level storage wrapper responsible for catching browser storage exceptions.
2. Return or record explicit failure information from save, update, and delete operations.
3. Let the application show a small, non-blocking notice when a checkpoint or preference could not be persisted.

Avoid popping up an error for every failed write. A single notice with a retry or dismiss action is preferable, with deduplication to prevent repeated warnings.

Add tests for quota failures, unavailable storage, malformed saved JSON, and deletion failure. Verify that the UI does not imply a round has been saved when it has not.

Do not migrate everything to IndexedDB automatically. First measure checkpoint sizes and confirm that quota or synchronous-write performance is actually a problem.

5\. Obsolete movie partitions can accumulate in the runtime cache

P2

Files: [sw.js](https://github.com/venkate5hgunda/arcade/blob/main/sw.js), [movie-library.js](https://github.com/venkate5hgunda/arcade/blob/main/js/movie-library.js), [partitions.py](https://github.com/venkate5hgunda/arcade/blob/main/dev/movies/partitions.py)

The movie catalog uses content-hash-based partition filenames, which is a good way to avoid serving stale content under a reused filename. The index points to the current partitions, and the service worker retains them for offline play.

The remaining issue is cleanup: `cacheMovieIndex()` ensures that required partitions are available but does not remove old movie partitions from the active runtime cache when a refreshed index no longer references them. The old entries may therefore persist until a service-worker cache-version upgrade.

Recommended change: after successfully caching the new index and its current partitions, remove obsolete movie partition entries from the Arcade-owned data cache. Do not delete a previous usable catalog before the new one has been made available.

Add a test that performs two catalog refreshes with different content-hash filenames and verifies both that the new partitions are available and that unreferenced partitions do not accumulate indefinitely.

Keep the atomic publication pattern in the Python export pipeline and the existing offline fallback behavior.

## 2. Architecture and maintainability

The central architectural challenge is not the lack of a framework. It is the growing responsibility of several large modules.

The project already has useful boundaries, and I would strengthen those rather than replace them.

### A. Split the largest modules along responsibility boundaries

Current file sizes include:

| File                                                                                   | Approximate size | Suggested direction                                                                               |
| -------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------- |
| [multiplayer.js](https://github.com/venkate5hgunda/arcade/blob/main/js/multiplayer.js) | 73 KB            | Separate WebRTC transport, signaling codec, room protocol/checkpoint service, and lobby rendering |
| [catan.js](https://github.com/venkate5hgunda/arcade/blob/main/games/catan.js)          | 85 KB            | Separate rules/state transitions, board generation, private views, and rendering                  |
| [business.js](https://github.com/venkate5hgunda/arcade/blob/main/games/business.js)    | 65 KB            | Separate presentation from room synchronization and keep rules in `business-engine.js`            |
| [game-shell.js](https://github.com/venkate5hgunda/arcade/blob/main/js/game-shell.js)   | 38 KB            | Extract cohesive setup, help, reset, and player-control components                                |
| [catalog.py](https://github.com/venkate5hgunda/arcade/blob/main/dev/movies/catalog.py) | 54 KB            | Separate database/schema concerns, ingestion/matching, and provider-client responsibilities       |

These numbers are rounded from the repository file listings.

Large files are not inherently bad. In this case, however, the room system and the more sophisticated games combine multiple forms of state, rendering, validation, and recovery. That makes changes harder to review and raises the risk of accidentally breaking unrelated behavior.

For multiplayer, I would extract in this order:

1\. Signaling and link codec

Move URL encoding/decoding, payload bounds, SDP validation, and invitation parsing into a dedicated module. These behaviors are relatively self-contained and easy to test.

2\. Connection lifecycle

Separate peer creation, channel setup, connection timeouts, disconnect detection, and disposal. Add explicit lifecycle tests to prevent timer and event-handler leaks.

3\. Room protocol and recovery

Centralize envelope validation, sequence and generation handling, roster invariants, checkpoint serialization, and recovery. Keep game-specific authorization and private views in the corresponding game adapters.

4\. Lobby rendering

Move DOM construction and interaction wiring out of the transport class. The transport should emit room state changes without knowing how its lobby looks.

Do not rewrite all multiplayer game adapters at once. The host-authoritative model, recipient-specific private views, seat authorization, and revision checks are key correctness boundaries. Preserve them and refactor in small steps.

For Island Charter, the natural first split is a pure rules/state module versus presentation and animation. The existing `business-engine.js` provides a useful precedent.

### B. Introduce a versioned checkpoint envelope

Local game checkpoints have per-game validators, which is a good foundation. The gap is that there is no consistent schema-version envelope across all saved local game sessions.

A future game refactor can change the shape of a checkpoint. Without explicit versioning, an older save is liable to be discarded as invalid even if a safe migration would be possible.

I recommend a shared envelope with fields such as:

```
{
  schemaVersion: 1,
  savedAt: Date.now(),
  state: { /* game-owned checkpoint */ }
}
```

Use the envelope for shared persistence concerns only. Each game should still own its schema, validation rules, and migration function.

For example, the session recovery layer could perform:

1. Parse and validate the envelope.
2. Migrate known older versions to the current game schema.
3. Run the game's `validCheckpoint()` function.
4. Restore or discard the checkpoint with a clear reason.

Start with a compatibility test for every currently supported checkpoint format before changing the storage structure. The multiplayer room checkpoint also has a version field, but its versioning does not replace game-specific state versioning.

### C. Reduce manually maintained integration lists

Adding a game currently touches several places: `js/game-catalog.js`, the game implementation, help text, resume settings, service-worker assets, tests, and documentation. This is understandable without a build system, but it creates opportunities for drift.

A particularly effective change would be an integration consistency test that checks:

- Every catalog ID is unique.
- Every catalog ID maps to an existing game module.
- Every module needed for offline operation is in the service-worker precache.
- Every local game has an intentional resume policy.
- Every room-capable game is registered with the appropriate player limits and protocol category.
- Every catalog game has help content, unless it is deliberately exempted.

Keep `GAMES` as the source of truth for game metadata. A small test can parse the source files and assert those invariants without adding a runtime dependency or a bundler.

For the service-worker asset list, a generated manifest would be even better, but a consistency test is the lowest-risk first step.

## 3. Multiplayer correctness and privacy

This subsystem deserves special attention because a visible rendering defect and a state-authority defect have very different consequences.

The existing code has good foundations: bounded messages, host ownership, monotonically sequenced actions, explicit player membership, and per-seat views for games with private information. The next step is to formalize the invariants that connect those pieces.

### A. Separate protocol validation from game validation

The room layer validates the structure of incoming messages and applies general rules such as message-size limits and sequence ordering. The individual game engine must still validate legal actions and state transitions.

Keep those as two distinct responsibilities:

| Layer         | Should validate                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| Room protocol | Sender identity, room membership, game generation, sequence numbers, message shape and size, host/guest role       |
| Game adapter  | The sender's seat, allowed action for that seat, current phase, turn/revision, recipient and state synchronization |
| Game engine   | Pure rule legality, state consistency, winner determination and invariants                                         |

This separation is more valuable than adding a large generic validation framework. It also makes failures easier to diagnose.

### B. Strengthen restoration tests, not just move tests

The current tests cover important behavior, including private hands, room recovery, stale requests, and game rules. The next increment should focus on malformed persisted state and recovery transitions.

For each room-capable game, test a matrix of:

- Fresh start.
- Valid checkpoint restoration.
- Malformed checkpoint rejection.
- Stale revision/action rejection.
- Guest reconnect and resynchronization.
- Host restoration before guests reconnect.
- Spectator or eliminated-seat behavior.
- No disclosure of another player's hidden data.

The test suite already exercises these areas for some games. The goal is to make those guarantees systematic across all room games.

In particular, add direct deep-validation tests for Mafia, then review the validators in `catan.js`, `uno.js`, `crazy-eights.js`, and the Business engine against the same principles. Do not assume their validation is defective simply because the Mafia validator needs strengthening.

### C. Make lifecycle transitions explicit

The multiplayer implementation has several related states: connected, disconnected, admitted, selected to play, restored, and ready to resume. These states are currently coordinated through event handlers and boolean flags.

As the code is split, define legal transitions and test them. For example, a restored host should not accept normal game actions until it has explicitly resumed the saved game. A guest reconnecting should receive the correct state snapshot rather than replaying stale local state.

You do not necessarily need a new state-machine library. A set of explicit transition functions and invariant tests may be sufficient.

Also preserve the documented transport limitations: there is no signaling service or TURN relay, and peer connections do not survive a tab reload. Those are architectural constraints of the current serverless model, not ordinary code defects.

## 4. Testing, automation, and release confidence

One of the largest opportunities for improving overall code quality is to make the existing test suite an enforced gate.

The project uses Node's built-in test runner and Python's `unittest`, without a package-install or bundling step. That is a meaningful advantage: continuous integration can stay inexpensive and simple.

### A. Add GitHub Actions CI

I did not find a workflow under `.github/workflows` in the current repository tree. The project has test commands, but there is no visible CI workflow enforcing them on pull requests.

I would add a workflow that runs at least:

```
npm test
npm run test:movies
```

Run the Node tests on a supported Node version and the Python tests on the documented minimum supported Python version. A second Python version can be added later if compatibility becomes a priority.

Since there is no configured linter, add a separate, intentional linting step rather than silently changing formatting conventions. ESLint for browser ES modules would be reasonable; keep its configuration compatible with the no-build runtime.

Make the CI checks required before merging. This turns manual discipline into an enforced quality gate.

### B. Improve game-level regression coverage

The test suite is meaningful, but coverage is uneven across the individual game implementations. The current test tree includes dedicated suites for Hangman and Mafia, even though parts of `ARCHITECTURE.md` still describe those games as lacking them.

The highest-value next additions are dedicated rules tests for games without a corresponding test file, including Blackjack, Minesweeper, Pool, Simon Says, and Word Scramble.

For game engines, favor tests of deterministic state transitions and edge cases instead of relying only on rendered HTML snapshots. Particularly useful cases include:

- Boundary conditions and terminal states.
- Invalid moves leaving the original state unchanged.
- Reset and restore behavior.
- Timer expiry and interrupted animation.
- Randomness with injectable seeded or deterministic sources.

For touch, sound, camera, WebRTC, and service-worker updates, unit tests should be complemented with a small browser-level smoke suite. A real-device test is still important for platform-specific audio, haptics, and camera behavior; a successful desktop automation run cannot establish those properties.

### C. Add service-worker integration checks

Offline support is a prominent feature and depends on a manually maintained asset manifest.

Add tests for a clean installation, a cache-version upgrade, offline startup, dynamic game-module loading, and movie-catalog refresh. Also verify that every precached asset exists and that the service worker does not delete caches it does not own.

The existing `test/movie-offline.test.js` is a useful starting point for cache-upgrade tests. Extend it to cover cache isolation and obsolete partition cleanup rather than replacing the existing offline fallback behavior.

## 5. Documentation and source-of-truth consistency

The repository has more documentation than many small projects: `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `BUSINESS_RULES.md`, `MAFIA_RULES.md`, and the movie-pipeline documentation. That is a strength, especially for an app with complex rules and recovery behavior.

The weakness is that some of those documents no longer agree with the implementation.

| Observed discrepancy                                                                                | Recommended correction                                                       |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `README.md` lists 22 games but omits Mafia                                                          | Add Mafia and document its multiplayer requirements and rules                |
| `ARCHITECTURE.md` reports 22 games, while the current catalog has 23 entries                        | Update the inventory and supported-game count                                |
| Architecture documentation lists 10 room games; `REMOTE_GAMES` currently includes 11                | Keep the room capability list synchronized with the actual registry          |
| Architecture documentation reports 22 test files; the current test tree contains substantially more | Update the test inventory and remove obsolete counts                         |
| Architecture documentation says Hangman lacks a dedicated rules test                                | Correct the statement to reflect `test/hangman.test.js`                      |
| The README project layout and feature descriptions omit newer game modules and related files        | Update the project layout and feature descriptions when revising the catalog |

See [README.md](https://github.com/venkate5hgunda/arcade/blob/main/README.md), [ARCHITECTURE.md](https://github.com/venkate5hgunda/arcade/blob/main/ARCHITECTURE.md), [game-catalog.js](https://github.com/venkate5hgunda/arcade/blob/main/js/game-catalog.js), and [multiplayer.js](https://github.com/venkate5hgunda/arcade/blob/main/js/multiplayer.js).

Specific change: remove duplicated numerical claims from narrative documentation wherever possible. Put the maintained game inventory in one place or generate a report from the catalog, and use tests to verify the room-support list against that inventory.

The maintenance map is most useful when its claims can be trusted. Outdated documentation is more than cosmetic: it can lead future contributors to miss a capability or assume a known issue remains unresolved.

## 6. Movie-catalog pipeline

The Python subsystem is worth reviewing as its own component because it adds external providers, persistence, editorial/model annotations, and a sizable dataset to the browser app.

### What is already well designed

The pipeline has several good properties:

- A SQLite-backed system of record.
- Lossless storage of supplied source records and provider responses.
- Explicit identity matching rather than indiscriminate merging by title.
- Provider request budgets and a resumable maintenance workflow.
- A partitioned public export that separates gameplay data from private development data.
- A dedicated Python test suite covering ingestion, export, annotations, and maintenance.

Those are sound foundations for data integrity and reproducibility.

### What I would improve next

First, divide responsibilities in [catalog.py](https://github.com/venkate5hgunda/arcade/blob/main/dev/movies/catalog.py) into clearer units as the code continues to grow. The existing `wikidata.py`, `game_export.py`, `partitions.py`, and annotation modules already demonstrate reasonable boundaries. Extend those boundaries rather than moving everything into a single abstractions layer.

Second, strengthen export validation. The published index includes partition paths, record counts, byte counts, and SHA-256 values. The browser loader currently validates the index shape and partition record counts, but does not verify those byte counts or hashes. Consider checking the expected hash and length when loading a partition, particularly during maintenance and release validation. This would detect mismatched or corrupted data that happens to contain the expected number of JSONL rows.

Third, keep the public/private boundary under automated test. The project server intentionally prevents direct access to `.env` and `dev/`, and the exporter is designed to publish only approved records. Retain tests proving that private source records, provider credentials, and raw development exports cannot enter the public export accidentally.

Finally, keep provider budgets, failure behavior, and catalog coverage claims explicit. The existing documentation does this well; the main improvement is ensuring its reported state and the committed catalog stay aligned.

## 7. Concrete implementation roadmap

I would divide the improvements into small, reviewable changes rather than bundle them into a single refactor.

## Review action plan

0 of 8 checked

FIRST

Fix service-worker cache isolation

Restrict cache deletion to Arcade-owned caches and add a test preserving unrelated caches.

Fix game-module error reporting

Distinguish intentional unavailability from import failures, and add loader-level regression tests.

Deepen Mafia checkpoint validation

Validate nested actions, skipped seats and clues; add direct malformed-checkpoint tests.

NEXT

Expose persistence failures

Standardize failed save/delete reporting and test storage-unavailable behavior.

Add CI and integration consistency checks

Run Node and Python suites on pull requests; validate catalog/module/help/precache consistency.

Update documentation

Correct game counts, room-support inventory, test counts and the README feature catalog.

LATER

Extract transport and game engines

Split multiplayer.js and catan.js incrementally, preserving protocol and checkpoint compatibility.

Improve offline-cache lifecycle

Remove obsolete content-hashed movie partitions and validate current catalog integrity.

&#x20;Copy plan

## Final recommendation

The best next step is to harden the existing system before expanding its feature set. Start with the service-worker lifecycle, error handling, and Mafia checkpoint validation. Add CI and cross-module consistency tests so future changes cannot silently regress offline operation or leave the documentation behind.

Then refactor the largest modules in small increments, beginning with multiplayer transport and the Island Charter engine. Keep the dependency-free, no-build-step approach unless a specific performance or development problem justifies changing it.

Arcade already has a credible architecture for a large collection of browser games. The biggest gains now will come from making its invariants explicit, its failures observable, and its tests comprehensive enough that the next feature is cheaper and safer to add.