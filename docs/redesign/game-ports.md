# Game migration status

**24 of 26 games are implemented.** The remaining 2 are authorized and tracked in the [backlog](backlog.md). PR #2's first-game work is complete and remains unmerged for review; puzzle ports are a stacked review unit on `codex/redesign-puzzle-games`.

| Family | Implemented | Remaining |
| --- | --- | --- |
| Puzzle | Tic-Tac-Toe, Connect Four, Minesweeper, Memory Match, 2048, Simon Says | None |
| Cards | Blackjack, Crazy Eights, UNO-inspired | None |
| Board | Snakes & Ladders, Ludo, Chess | Island Charter, Business |
| Action | Whack-a-Mole, Air Hockey, 8-Ball Pool | None |
| Party | Show, Taboo, Rock Paper Scissors, Dumb Charades, Imposter, Mafia | None |
| Word | Wordle, Hangman, Word Scramble | None |

## Puzzle acceptance and evidence

- **Connect Four:** local one/two-player options, baseline heuristic AI, gravity/full-column enforcement, winning lines, draw/reset, checkpoint recovery, real two-browser authoritative room play and host-reload recovery.
- **Minesweeper:** all three baseline sizes, first-reveal neighborhood safety, preflags, flood reveal, flag mode/right-click/F key, win/loss and validated saved fields. Wide fields scroll inside the board on mobile.
- **Memory Match:** 4/6/8 grids, one/two players, concealed cards, delayed mismatches, match-retains-turn/mismatch-handoff, pair scoring, win/tie/rematch and recovery. A pending mismatch checkpoint is normalized to the resulting hidden pair and next actor.
- **2048:** baseline once-per-move merging and score/record keys, arrow/swipe/button controls, staged movement/merge/spawn, queued input, 2048 continuation, no-op enforcement, game-over/reload behavior and reduced motion.
- **Simon Says:** all three speeds, growing sequence, locked watch phase, numbered/color-labelled pads, input success/failure, high scores, restored partial-round replay, rematch and timer cleanup.

Checks: `redesign/checks/unit/puzzles.check.ts`, `room.check.ts`, `redesign/checks/browser/puzzles.spec.ts` and `foundation.spec.ts`. Original game modules remain unchanged and serve as behavior references. All implemented flags, route consumers, checkpoint readers and room projections were traced together.

![Five new puzzle games, mobile browser captures](../images/redesign-puzzles-mobile.png)

## Blackjack acceptance and evidence

Native solo Blackjack preserves the 52-card deck, ace handling, dealer standing on soft 17, hit/stand, two-card doubling, naturals paying 3:2, push/bust/settlement, session record and baseline-compatible five-minute checkpoint. Dealer hole cards expose no rank in the DOM until reveal. Natural initial deals finish immediately and cannot appear as resumable games. Fictional units only.

Evidence: `redesign/checks/unit/blackjack.check.ts` and `redesign/checks/browser/art-blackjack.spec.ts`; complete desktop/mobile flows, keyboard controls, accessibility, reload and record-preserving redeals. Shared audio/haptics remain A07 work.

![Native Blackjack on mobile](../images/redesign-blackjack-mobile.png)

## Private-card acceptance and evidence

- **Crazy Eights:** native two-player covered local hands and private rooms; suit/rank matching, wild-eight suit selection, one draw per turn, passing, discard recycling, empty-hand victory and blocked-hand penalty scoring. Choosing a suit survives reload; completed games are removed from local resume.
- **UNO-inspired:** native 2–20-player local tables and rooms; one/two decks, private hands, skip/reverse/+2/wild/+4, drawn-card restriction, challenge/accept, UNO callouts/catches, blocked termination, wins and replay. Names/settings/checkpoints retain baseline shapes. Reload covers local hands again.
- **Rooms:** independent host-to-guest data channels, strict seat projections, host-only deck backup, per-link sequence checks plus match round/revision, same-seat reconnect, pause while any player is disconnected and exactly-once results. Protocol v5 rejects older connection links. Valid v1–v4 host checkpoints can be restored and re-invited using v5 links.

Evidence: `redesign/checks/unit/cards.check.ts`, `room.check.ts`, and `redesign/checks/browser/cards.spec.ts`. Typed engines are compared against the originals through complete games at 2/3/10/11/20 players. Twenty-seat protocol admission/projection/reconnect is checked with deterministic transports; real WebRTC browser flows cover two-player Crazy Eights and three-player UNO, including host reload, preserved private hands, complete wins and rematches. Physical-device/network qualification and broader shared room criteria remain release gates.

| Crazy Eights | UNO-inspired |
| --- | --- |
| ![Crazy Eights mobile](../images/redesign-crazy-eights-mobile.png) | ![UNO mobile](../images/redesign-uno-mobile.png) |

## Race-game acceptance and evidence

Snakes & Ladders and Ludo support 2–4 local or room players, baseline-compatible checkpoints and host-authoritative dice. Snakes preserves the original seeded board, exact finish and 99-to-21 snake. Ludo preserves token release, choice, safe squares, captures, extra turns and exact home. Players can inspect squares or select tokens using touch and keyboard; motion respects reduced-motion settings.

Evidence: `redesign/checks/unit/races.check.ts` compares seeded boards and legal moves with the original engines, and `room.check.ts` exercises four-seat recovery and forged-action rejection. `redesign/checks/browser/races.spec.ts` covers desktop/mobile complete local wins and rematches, accessibility, and three real WebRTC peers reconnecting after host reload. Cross-network and physical-device qualification remain release gates.

## Wordle acceptance and evidence

Wordle retains the original offline vocabulary, repeated-letter scoring, six guesses and local checkpoints. Players can type or use the on-screen keyboard; symbols accompany color feedback. Complete wins, losses, invalid guesses, reload, replay and accessibility are covered in `redesign/checks/browser/wordle.spec.ts`, with original vocabulary and scoring comparisons in `redesign/checks/unit/wordle.check.ts`.

## Hangman acceptance and evidence

Hangman retains the original 85-word pool, category clues, six misses, alternating two-player guesses, repeated-letter handling and compatible local checkpoints. Original-engine comparisons cover complete rounds in `redesign/checks/unit/hangman.check.ts`; `redesign/checks/browser/hangman.spec.ts` covers wins, losses, turns, clues, reload, replay, keyboard and accessibility on desktop and mobile.

## Word Scramble acceptance and evidence

Word Scramble preserves the original word pool, 5/8/12-round options, hints, skips, scoring, saved rounds and delayed advance after a correct answer. Desktop/mobile complete-round and recovery checks are in `redesign/checks/browser/scramble.spec.ts`; checkpoint, pool and completion checks are in `redesign/checks/unit/scramble.check.ts`.

## Whack-a-Mole acceptance and evidence

Whack-a-Mole retains 30/45/60-second rounds, randomly timed targets, hit/miss scoring, best score and absolute-deadline recovery. Interactive illustrated moles support touch and keyboard. `redesign/checks/unit/whack.check.ts` validates saved timed state; `redesign/checks/browser/whack.spec.ts` exercises hit, miss, reload, expiry, score and replay on desktop and mobile.

## Taboo acceptance and evidence

Taboo retains the original clue deck, two-team scoring, 30/60/90-second turns, 4/6/8 turns and absolute deadlines. Covered handoffs keep cards out of the rendered interface until the clue giver reveals them, including after reload. `redesign/checks/unit/taboo.check.ts` compares cards, scoring and deadline rules to the original; `redesign/checks/browser/taboo.spec.ts` covers recovery, scoring, hiding, expiry and complete results on desktop/mobile.

## Show acceptance and evidence

Show retains 3–8 players, 3/5/10 rounds, private chit handoffs, simultaneous clockwise passes, matching hands, slap order and point scoring. Chits are removed from the rendered interface between players and on reload. Original-rule comparisons are in `redesign/checks/unit/show.check.ts`; `redesign/checks/browser/show.spec.ts` covers handoffs, passing, recovery, slap scoring and a complete match on desktop/mobile.

## Porting rule

Keep each family reviewable and push completed units. Do not flip a game's parity record until complete gameplay and recovery have passed in desktop Chromium and mobile WebKit. Do not substitute original-app links, placeholder boards, simplified rules or a legacy iframe for a native game port. Shared PWA/audio/room breadth remain separate release gates.

## Shared card and pile components

The original app's `js/playing-cards.js` and `js/card-pile.js` centralize standard playing cards and layered piles. The separate redesign runtime shares `PlayingCard` and `CardPile` across Blackjack and Crazy Eights; UNO uses its own face art with the same pile. Face-down draw piles do not reveal hidden cards, and discard stacks show only the public top. Island Charter and Business retain piles in the original app; their redesigned versions are still planned.

## Rock Paper Scissors acceptance and evidence

Native computer/pass-and-play modes preserve first-to-3/5/7 settings, secret handoffs, all nine throw outcomes, ties, absolute countdown recovery and replay. Rooms preserve independently chosen throws, first-to-3 matches, host-only next-round control, standings, reconnect and tab recovery. Guest projections contain their own throw and opponent lock status; neither throw is revealed until the host finishes the countdown. Protocol v5 rejects older peers and restores valid v1–v4 host backups with fresh invitations.

Evidence: `redesign/checks/unit/rps.check.ts`, `room.check.ts`, and `redesign/checks/browser/rps.spec.ts`; eight desktop/mobile flows cover full matches, computer play, deadlines, navigation cleanup, accessibility and real two-browser reload/reconnect. Physical-device and cross-network qualification remains a release gate.

## Chess acceptance and evidence

Native local/computer play preserves White/Black selection, automatic board orientation, legal moves, check/checkmate, stalemate, insufficient material, castling, en passant and four promotion choices. Original piece silhouettes and checkpoint fields are retained. Keyboard arrows navigate squares; legal moves and piece identities have accessible names. Pending promotion and AI turns recover after reload, and disposed AI timers cannot act on another game.

Host-authoritative rooms enforce White/Black seat turns, legal moves and promotions, stale-action rejection, disconnected-seat pauses, host reload, same-seat reconnect, exactly-once wins/draws and replay. Chess and RPS use protocol v5.

Evidence: `redesign/checks/unit/chess.check.ts`, `room.check.ts`, and `redesign/checks/browser/chess.spec.ts`. Legal-move/position comparisons run through a complete original-engine checkmate; special-move and draw fixtures plus six desktop/mobile flows cover promotion recovery, AI, keyboard/accessibility and a real two-browser recovered game. The original engine's supported draw rules are preserved; repetition/50-move claims were never baseline capabilities.

## Dumb Charades acceptance and evidence

Native 2/4/6/8-player teams retain classic prompts, 10–360-second turns, actor/team rotation, skipped/correct scoring, the ten-success end rule, replay and absolute-deadline recovery. Telugu movies use the 4,814-record approved catalog from the original publishing pipeline, with year/difficulty filters and cast/synopsis for the actor and after a turn. The build copies indexed, validated catalog partitions into the isolated preview; loading errors offer a retry.

Evidence: `redesign/checks/unit/charades.check.ts` compares checkpoint shapes and filters to the original implementation; `redesign/checks/browser/charades.spec.ts` covers six desktop/mobile flows including completion, replay, timeout, movie details, filters, retry and accessibility. Full production offline caching remains a Phase 4 gate.

## Imposter acceptance and evidence

Native 3–20-player Classic and Pair modes retain the original 21 word/movie categories, category/hint/team intel, one to six imposters, optional secret random counts, private card handoffs, decoy words, discussion, covered ballots, tied votes, elimination history and both win conditions. Old single-imposter checkpoints migrate; cards and ballots return covered on reload or backgrounding. Telugu movie selections share the approved catalog and year/difficulty filters.

Evidence: `redesign/checks/unit/imposter.check.ts` compares original categories, limits and checkpoint validation; `redesign/checks/browser/imposter.spec.ts` exercises complete Classic games, Pair secrecy, legacy recovery, movie options, replay and accessibility on desktop/mobile. A Pair game with one eligible movie and other selected categories now picks a viable category instead of dealing an empty decoy.

## Air Hockey acceptance and evidence

Native two-player Air Hockey retains first-to-5/7/10 options, fixed-step disc physics, accelerated paddles, keyboard and independent pointer controls, opening faceoff, rebounds, scoring, receiving serves, win/replay and baseline-shaped checkpoints. The entire table fits in the initial mobile viewport; each half accepts a drag without requiring a precise paddle hit.

Evidence: `redesign/checks/unit/hockey.check.ts` compares collisions, drag, acceleration and impacts directly with the original solver and exercises both goals and serving; `redesign/checks/browser/hockey.spec.ts` covers desktop/mobile keyboard and pointer play, recovery, scoring, rematch, accessibility and reset. Shared sound/haptics and physical-device qualification remain A07/release gates.

## 8-Ball Pool acceptance and evidence

Native two-player Pool preserves the original rack, aiming and shot power, fixed-step disc collisions/pockets, group assignment, turn retention, no-contact/wrong-contact/rail/scratch fouls, cue respot, early/fouled or legal 8-ball outcomes and replay. A stable pre-shot table is saved while the balls roll, so interrupted shots can be replayed. The table supports keyboard and drag shots; an expandable inventory makes each numbered ball and pocketed state inspectable.

Evidence: `redesign/checks/unit/pool.check.ts` compares the seeded rack and saved shape with the original and exercises fouls plus real physical 8-ball shots. `redesign/checks/browser/pool.spec.ts` covers eight desktop/mobile flows including real break/aim/power, drag, in-motion recovery, 8-ball outcomes, replay and accessibility. Physical-device and shared audio/haptic qualification remain release gates.

## Mafia acceptance and evidence

Native private rooms support five to ten players, host-held shuffled roles, Mafia night targets, Doctor protection, Detective private clues, daytime discussion, secret votes and abstentions, ties, elimination, winning teams and replay. Each seat receives only its role, permitted allies, own clues and own action until final role reveal. The host may mark a disconnected pending seat absent, and host tab recovery retains private state and seat identities. Protocol v5 rejects old connections and restores valid v1–v4 host backups via fresh invitations.

Evidence: `redesign/checks/unit/mafia.check.ts` compares the native rules and projections with the original across 5–10 seats; `redesign/checks/unit/room.check.ts` covers privacy, full wins, absent seats, rejected actions, protocol migration and recovery. `redesign/checks/browser/mafia.spec.ts` completes a game across five real browser contexts on desktop and mobile, including reconnection and private clues. Cross-network and physical-device qualification remain release gates.
