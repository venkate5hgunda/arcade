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

## Phase 3 — game ports (active)

- [x] **Puzzle family (G20–G24):** Connect Four (local/AI/room), Minesweeper,
      Memory Match, 2048 and Simon Says. Typed rules, native React controls,
      baseline-compatible checkpoints/settings, complete-game browser flows.
- [x] **Blackjack (G16):** native solo table, deck/aces/naturals/doubling, scoring and recovery.
- [x] **Remaining cards (G17–G18):** Crazy Eights and UNO-inspired, native covered local play and private rooms, full baseline rules, 2–20-player UNO, recovery and replay.
- [x] **Race board games (G07–G08):** Snakes & Ladders and Ludo, with 2–4-player local/room play and recovery.
- [x] **Chess (G11):** full rules, local/computer modes, promotion recovery, native accessible board and authoritative two-browser rooms.
- [ ] **Remaining board:** Island Charter, Business.
- [x] **Whack-a-Mole (G06):** timed targets, scoring and absolute-deadline recovery.
- [x] **Air Hockey (G04):** native two-player table, fixed-step collisions, touch/keyboard controls, serving and recovery.
- [x] **8-Ball Pool (G05):** native table, physical shots, house rules, inspection and stable-table recovery.
- [x] **Taboo (G02):** covered clues, team scoring and deadline recovery.
- [x] **Show (G01):** covered chits, simultaneous passes and slap-order scoring.
- [x] **Rock Paper Scissors (G15):** secret local throws, computer, 3/5/7-win matches, countdown recovery and private two-browser rooms.
- [x] **Dumb Charades (G14):** team rotation, timed acting, classic prompts and filtered Telugu movies with recovery.
- [x] **Imposter (G12):** original words, decoys, secret cards, private ballots, Classic/Pair options and legacy recovery.
- [x] **Mafia (G13):** 5–10-player private rooms, host-held roles, night/vote phases, private clues and recovery.
- [x] **Wordle (G03):** offline practice, repeated-letter feedback and local recovery.
- [x] **Hangman (G25):** original word pool, solo/two-player rounds and recovery.
- [x] **Word Scramble (G26):** original word pool, hints, rounds and recovery.

See [game-port evidence](game-ports.md). The user has authorized all remaining
ports; this is active work, not a claim that the full redesign is complete.

## Next

- [ ] **More games (G04–G05, G09–G15).** Port the remaining 2 catalog
      entries in coherent families (Board, Action, Party, then Word). Each reuses the shared catalog, setup, turn banner, persistence and
      (where room-supported) room layer. Preserve per-game rules, options and
      transitions from the cited `games/*.js` module; add a complete behavior
      test per game before flipping its parity status to `implemented`.
- [ ] **Room breadth (A04–A06).** Add QR admission/scanning, spectators and the remaining game protocols. Private card hands/decks and 20-seat UNO are implemented; extend the room to remaining
      room-supported games and private roles, spectator
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
