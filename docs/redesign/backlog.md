# Redesign backlog

Larger work items surfaced during the redesign. Each is a coherent feature
component; none is a one-off. Items are pulled proactively as capacity allows
so technical debt does not accumulate.

Phase 2 is complete on `codex/redesign-first-game`; this backlog describes later migration milestones, not unverified work hidden inside the first-game implementation.

## Phase 2 — first complete feature (this PR)

Scope: the **catalog + shared game experience + persistence + one two-browser
room flow**, all demonstrated on **Tic-Tac-Toe** (G19) as the first fully
migrated game. The original `games/*.js` modules remain the behavior
reference; the redesign builds clean, typed equivalents.

- [x] Catalog with all 26 baseline entries, category filter, recent games,
      per-game resume and legacy deep-link aliases (A01, first-game scope).
- [x] Shared game experience: collapsed setup with summary + immediate start,
      expandable configuration, help, player names, reset confirmation, turn
      banner and victory feedback (A02).
- [x] Persistence and recovery: `arcade:` settings/names/scores/recent/checkpoints
      with per-game expiry and Tic-Tac-Toe checkpoint validation (A03, first-game scope).
- [x] Two-browser room flow for Tic-Tac-Toe: serverless two-URL signaling,
      host authority, seat/round/revision validation, reconnection and a
      tab-scoped host checkpoint (A04–A06 for Tic-Tac-Toe).
- [x] Local + room Tic-Tac-Toe: 1/2-player, computer (minimax), win/draw,
      reset, legal-cell enforcement (G19).

## Next

- [ ] **More games (G01–G18, G20–G26).** Port the remaining 25 catalog
      entries in coherent families (Puzzle, then Cards, Board, Action, Party,
      Word). Each reuses the shared catalog, setup, turn banner, persistence and
      (where room-supported) room layer. Preserve per-game rules, options and
      transitions from the cited `games/*.js` module; add a complete behavior
      test per game before flipping its parity status to `implemented`.
- [ ] **Room breadth (A04–A06).** Add QR admission/scanning and extend beyond the two-player flow. Extend the room to the other
      room-supported games and add private-hand/role/deck views, spectator
      seats, per-game/player standings and rankings across replays.
- [ ] **Sound, feel and themes (A07).** Auto/light/dark theme, persistent
      sound/haptics settings, user-gesture audio unlock and recovery,
      impact-sensitive synthesized effects and reduced-motion support across all
      surfaces.

## Later

- [ ] **PWA and recovery (Phase 4).** Versioned storage migration, offline
      asset graph, scope-safe service-worker update handling, install/standalone
      testing, quota/private-mode and multi-tab behavior.
- [ ] **Real-model qualification.** Any model/inference paths are qualified on a
      fresh browser per the user's standing gate, not from cached reports.
- [ ] **Full parity release (Phase 5).** Execute every acceptance case and the
      complete original regression suite; review documented corrections, data
      migration, artwork and real-device behavior. No open blocker may hide
      behind an `implemented` status.
