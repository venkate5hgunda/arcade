# Game migration status

**6 of 26 games are implemented.** The remaining 20 are authorized and tracked in the [backlog](backlog.md). PR #2's first-game work is complete and remains unmerged for review; puzzle ports are a stacked review unit on `codex/redesign-puzzle-games`.

| Family | Implemented | Remaining |
| --- | --- | --- |
| Puzzle | Tic-Tac-Toe, Connect Four, Minesweeper, Memory Match, 2048, Simon Says | None |
| Cards | — | Blackjack, Crazy Eights, UNO-inspired |
| Board | — | Snakes & Ladders, Ludo, Island Charter, Business, Chess |
| Action | — | Air Hockey, 8-Ball Pool, Whack-a-Mole |
| Party | — | Show, Taboo, Imposter, Mafia, Dumb Charades, Rock Paper Scissors |
| Word | — | Wordle, Hangman, Word Scramble |

## Puzzle acceptance and evidence

- **Connect Four:** local one/two-player options, baseline heuristic AI, gravity/full-column enforcement, winning lines, draw/reset, checkpoint recovery, real two-browser authoritative room play and host-reload recovery.
- **Minesweeper:** all three baseline sizes, first-reveal neighborhood safety, preflags, flood reveal, flag mode/right-click/F key, win/loss and validated saved fields. Wide fields scroll inside the board on mobile.
- **Memory Match:** 4/6/8 grids, one/two players, concealed cards, delayed mismatches, match-retains-turn/mismatch-handoff, pair scoring, win/tie/rematch and recovery. A pending mismatch checkpoint is normalized to the resulting hidden pair and next actor.
- **2048:** baseline once-per-move merging and score/record keys, arrow/swipe/button controls, staged movement/merge/spawn, queued input, 2048 continuation, no-op enforcement, game-over/reload behavior and reduced motion.
- **Simon Says:** all three speeds, growing sequence, locked watch phase, numbered/color-labelled pads, input success/failure, high scores, restored partial-round replay, rematch and timer cleanup.

Checks: `redesign/checks/unit/puzzles.check.ts`, `room.check.ts`, `redesign/checks/browser/puzzles.spec.ts` and `foundation.spec.ts`. Original game modules remain unchanged and serve as behavior references. All implemented flags, route consumers, checkpoint readers and room projections were traced together.

![Five new puzzle games, mobile browser captures](../images/redesign-puzzles-mobile.png)

## Porting rule

Keep each family reviewable and push completed units. Do not flip a game's parity record until complete gameplay and recovery have passed in desktop Chromium and mobile WebKit. Do not substitute original-app links, placeholder boards, simplified rules or a legacy iframe for a native game port. Shared PWA/audio/room breadth remain separate release gates.
