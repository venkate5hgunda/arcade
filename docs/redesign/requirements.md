# Requirements and feature parity

Baseline commit: `ae1136d6e544784811e5c334ee76d6c54b6921a3`. Goal: preserve 100% of user-visible capabilities, saved-data compatibility, accessibility and meaningful privacy boundaries while allowing new internals and interaction flows. Equivalence is judged by outcomes, not pixel copying. Existing defects are not requirements; document intentional corrections and their regression tests.

The inventory has **34 feature groups**. Groups contain multiple acceptance cases; the count is not a claim about total individual features. The cited baseline implementations and linked product documents are normative for options and rules not restated here. Any newly discovered behavior must be added before its implementation is retired. Unmapped tests and manual flows remain explicit follow-up work.

| ID | Feature | Area | Redesign status |
| --- | --- | --- | --- |
| [A01](#a01) | Catalog and navigation | Platform | Planned |
| [A02](#a02) | Shared game experience | Platform | Planned |
| [A03](#a03) | Persistence and recovery | Platform | Planned |
| [A04](#a04) | Room admission and sharing | Multiplayer | Planned |
| [A05](#a05) | Authority and private information | Multiplayer | Planned |
| [A06](#a06) | Room reconnection | Multiplayer | Planned |
| [A07](#a07) | Sound, feel and themes | Experience | Planned |
| [A08](#a08) | Offline assets and data pipeline | Platform | Planned |
| [G01](#g01) | Show | Party | Planned |
| [G02](#g02) | Taboo | Party | Planned |
| [G03](#g03) | Wordle | Word | Implemented |
| [G04](#g04) | Air Hockey | Action | Planned |
| [G05](#g05) | 8-Ball Pool | Action | Planned |
| [G06](#g06) | Whack-a-Mole | Action | Planned |
| [G07](#g07) | Snakes & Ladders | Board | Implemented |
| [G08](#g08) | Ludo | Board | Implemented |
| [G09](#g09) | Island Charter | Board | Planned |
| [G10](#g10) | Business | Board | Planned |
| [G11](#g11) | Chess | Board | Planned |
| [G12](#g12) | Imposter | Party | Planned |
| [G13](#g13) | Mafia | Party | Planned |
| [G14](#g14) | Dumb Charades | Party | Planned |
| [G15](#g15) | Rock Paper Scissors | Party | Planned |
| [G16](#g16) | Blackjack | Cards | Implemented |
| [G17](#g17) | Crazy Eights | Cards | Implemented |
| [G18](#g18) | UNO-inspired | Cards | Implemented |
| [G19](#g19) | Tic-Tac-Toe | Puzzle | Implemented |
| [G20](#g20) | Connect Four | Puzzle | Implemented |
| [G21](#g21) | Minesweeper | Puzzle | Implemented |
| [G22](#g22) | Memory Match | Puzzle | Implemented |
| [G23](#g23) | 2048 | Puzzle | Implemented |
| [G24](#g24) | Simon Says | Puzzle | Implemented |
| [G25](#g25) | Hangman | Word | Implemented |
| [G26](#g26) | Word Scramble | Word | Implemented |

## Shared release requirements

- Complete every acceptance case through a real browser flow; exercise errors, cancellation, reload and state recovery as appropriate.
- Preserve bright original artwork, legible contrast, touch and keyboard operation, focus management, reduced motion, and mobile/landscape/desktop layouts. Primary action and active actor remain apparent.
- Treat installation, first-load caching, fully offline operation, interrupted updates and multi-tab version consistency as separate cases.
- Keep behavior, domain state, persistent data and presentation independently testable; one authoritative owner for each state transition.
- A planned or merely implemented feature is not verified parity. Track pending, implemented and verified evidence separately when migration begins. Foundation status was all planned; Phase 2 implements G19 and Phase 3 implements G20–G24, with scoped progress on platform and room requirements. See verification.md for current evidence.
- A backend replacement must specify user-visible availability, consent, data retention, authority and recovery semantics before activation. Architectural freedom does not erase these requirements.

## A01

**Catalog and navigation** · Platform · Planned

- All 26 catalog entries retain IDs, player ranges, categories, rules and supported modes.
- Category filtering, deduplicated recent games, per-game resume and deep links remain available.
- Home stays home even with unfinished rounds; game deep links open the named game.
- Back/Forward and keyboard navigation dispose the old game; stale lazy loads cannot mount.
- Load failures are actionable errors rather than false Coming soon screens.

Sources: [js/game-catalog.js](../../js/game-catalog.js), [js/router.js](../../js/router.js), [docs/features.md](../../docs/features.md).

Baseline tests: [test/game-categories.test.js](../../test/game-categories.test.js), [test/game-session.test.js](../../test/game-session.test.js).

## A02

**Shared game experience** · Platform · Planned

- Collapsed setup shows a useful summary and immediate start; persist per-game choices.
- Help offers rules, controls and goals; player names and auxiliary settings stay expandable.
- Reset confirms intention; active actor, last outcome and next action stay visible above secondary content.
- Distinctive original pieces/boards, inspectable objects, touch/keyboard controls and reduced-motion feedback.
- Victory announces player/team; room guests celebrate their own wins.

Sources: [js/game-shell.js](../../js/game-shell.js), [js/game-help.js](../../js/game-help.js), [js/player-names.js](../../js/player-names.js), [js/turn-indicator.js](../../js/turn-indicator.js), [docs/features.md](../../docs/features.md).

Baseline tests: [test/game-shell.test.js](../../test/game-shell.test.js), [test/game-help.test.js](../../test/game-help.test.js), [test/player-names.test.js](../../test/player-names.test.js), [test/turn-indicator.test.js](../../test/turn-indicator.test.js).

## A03

**Persistence and recovery** · Platform · Planned

- Preserve arcade-prefixed settings, names, scores, recent games and local checkpoints.
- Use each game’s actual expiry from game-session.js; timed games retain absolute deadlines across hide/reload.
- Validate checkpoints; finished/expired rounds never resurrect; preference/high-score data survives expiry.
- Surface storage failures without blocking playable in-memory sessions.

Sources: [js/storage.js](../../js/storage.js), [js/game-session.js](../../js/game-session.js).

Baseline tests: [test/game-session.test.js](../../test/game-session.test.js).

## A04

**Room admission and sharing** · Multiplayer · Planned

- Host creates unique per-guest invitations; guest returns answer accepted in original host tab.
- Native share, clipboard fallback, local QR generation/scanning and raw-link fallback remain available.
- Camera denial, QR overflow and connection failure explain the next action.
- Connected guests default selected; host may spectate seats and sees games valid for selected count.

Sources: [js/multiplayer.js](../../js/multiplayer.js), [js/room-qr.js](../../js/room-qr.js), [docs/rooms.md](../../docs/rooms.md).

Baseline tests: [test/multiplayer.test.js](../../test/multiplayer.test.js), [test/room-qr.test.js](../../test/room-qr.test.js).

## A05

**Authority and private information** · Multiplayer · Planned

- Retain the eleven room-supported games and room-only Mafia behavior.
- Host validates actor, seat, round and revision; guests submit intents and cannot set authoritative outcomes.
- Private hands/roles/deck order stay on host; each recipient sees only its permitted view.
- Room standings retain per-game/player wins, losses, draws and rankings across replays.

Sources: [js/multiplayer.js](../../js/multiplayer.js), [js/remote-match.js](../../js/remote-match.js), [js/card-room-entry.js](../../js/card-room-entry.js), [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

Baseline tests: [test/multiplayer.test.js](../../test/multiplayer.test.js), [test/remote-match.test.js](../../test/remote-match.test.js).

## A06

**Room reconnection** · Multiplayer · Planned

- Transient disconnection pauses turns; same-seat invitation/answer recovery retains the round.
- Host reload restores a tab-scoped checkpoint; guests exchange fresh links and receive only their own views.
- Mismatched reconnect name cancels invitation without destroying seat or game.
- Eliminated Business seats do not block resume; surviving selected seats must reconnect.
- Disclose STUN/network need and absence of signaling/TURN; offline local play remains available.

Sources: [js/multiplayer.js](../../js/multiplayer.js), [docs/rooms.md](../../docs/rooms.md).

Baseline tests: [test/multiplayer.test.js](../../test/multiplayer.test.js).

## A07

**Sound, feel and themes** · Experience · Planned

- Auto/light/dark theme, persistent sound/haptics settings, user-gesture audio unlock and recovery.
- Impact-sensitive synthesized effects, distinct wins and optional haptics; reflect actual platform support.
- No promise of audible output from API readiness alone; test controls explain iOS limitations.
- High contrast, reduced motion and responsive original artwork across all game surfaces.

Sources: [js/audio.js](../../js/audio.js), [js/haptics.js](../../js/haptics.js), [js/theme.js](../../js/theme.js), [js/motion.js](../../js/motion.js), [docs/features.md](../../docs/features.md).

Baseline tests: [test/audio.test.js](../../test/audio.test.js), [test/haptics.test.js](../../test/haptics.test.js), [test/theme.test.js](../../test/theme.test.js).

## A08

**Offline assets and data pipeline** · Platform · Planned

- Cache shell, all game modules, icons, QR worker and approved movie content for local offline play.
- Retain Telugu movie sources/credits, top three actors and synopsis in appropriate revealed contexts.
- No movie details leak through hidden Imposter handoffs.
- Preserve developer-only ingestion/annotation/export tools and keep credentials/raw development data outside deployment.
- Keep attribution for original and third-party art/code.

Sources: [sw.js](../../sw.js), [js/movie-library.js](../../js/movie-library.js), [dev/movies/README.md](../../dev/movies/README.md), [dev/serve.py](../../dev/serve.py), [docs/credits.md](../../docs/credits.md).

Baseline tests: [test/movie-library.test.js](../../test/movie-library.test.js), [test/movie-offline.test.js](../../test/movie-offline.test.js).

## G01

**Show** · Party · Planned

- Display name Show; three to eight shared-device players, four chits each, concealed simultaneous clockwise passes.
- Four matching chits unlock slap, N through 1 stack scoring; 3/5/10 rounds and shared wins on ties; reload conceals hands; local only.
- Preserve catalog player range 3–8; full rules/options and transitions in the cited game are the baseline.

Sources: [games/show-star.js](../../games/show-star.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: [test/party-word-games.test.js](../../test/party-word-games.test.js).

## G02

**Taboo** · Party · Planned

- Four to twenty players in two teams; 30/60/90-second turns, 4/6/8 total turns, correct +1, skip 0, forbidden -1.
- Fifty original cards without repeats until exhausted; private clue giver/referee handoff; deadline continues hidden/reloaded; local only.
- Preserve catalog player range 4–20; full rules/options and transitions in the cited game are the baseline.

Sources: [games/taboo.js](../../games/taboo.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: [test/party-word-games.test.js](../../test/party-word-games.test.js).

## G03

**Wordle** · Word · Implemented

- Solo random five-letter practice, six guesses, curated offline vocabulary, repeated-letter accounting, physical/on-screen keyboard and accessible symbol feedback; new puzzle reset; local only.
- Preserve catalog player range 1–1; full rules/options and transitions in the cited game are the baseline.

Sources: [games/wordle.js](../../games/wordle.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: [test/party-word-games.test.js](../../test/party-word-games.test.js).

## G04

**Air Hockey** · Action · Planned

- Two-player paddle/puck controls; fixed-step collisions, drag, rebounds and goals; opening puck waits at center and post-goal serve waits on conceding half.
- Preserve catalog player range 2–2; full rules/options and transitions in the cited game are the baseline.

Sources: [games/air-hockey.js](../../games/air-hockey.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: [test/air-hockey.test.js](../../test/air-hockey.test.js).

## G05

**8-Ball Pool** · Action · Planned

- Two-player rack, aiming, disc collisions, pockets, scratches, assigned groups and house-rule eight-ball win/loss.
- Preserve catalog player range 2–2; full rules/options and transitions in the cited game are the baseline.

Sources: [games/pool.js](../../games/pool.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: No dedicated test mapped; add a complete flow test before parity sign-off.

## G06

**Whack-a-Mole** · Action · Planned

- Timed solo target interaction, hit/miss scoring and absolute-deadline resume.
- Preserve catalog player range 1–1; full rules/options and transitions in the cited game are the baseline.

Sources: [games/whack-a-mole.js](../../games/whack-a-mole.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: No dedicated test mapped; add a complete flow test before parity sign-off.

## G07

**Snakes & Ladders** · Board · Implemented

- Two to four local/room players; fair dice, square-by-square travel, ladders/snakes and legal finish; randomized non-intersecting board including long snake from 99.
- Preserve catalog player range 2–4; full rules/options and transitions in the cited game are the baseline.

Sources: [games/snakes-ladders.js](../../games/snakes-ladders.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: No dedicated test mapped; add a complete flow test before parity sign-off.

## G08

**Ludo** · Board · Implemented

- Two to four local/room players; full 52-cell cross track, legal token choice, capture, home path and victory; matching unnumbered pieces and active-home feedback.
- Preserve catalog player range 2–4; full rules/options and transitions in the cited game are the baseline.

Sources: [games/ludo.js](../../games/ludo.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: No dedicated test mapped; add a complete flow test before parity sign-off.

## G09

**Island Charter** · Board · Planned

- Three to four local/room players; opening dice ties and snake placement; roads/distance, resource production, robber/discards, bank/harbor/player trades, development cards and ten-point victory.
- Classic/changing nine harbors, illustrated/colorblock terrain and four adjacency options retain persistence.
- Inspect/zoom/pan full island with per-seat viewport; hidden cargo and deck remain private; harbor access derives from its two coastal junctions.
- Preserve catalog player range 3–4; full rules/options and transitions in the cited game are the baseline.

Sources: [games/catan.js](../../games/catan.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: [test/catan.test.js](../../test/catan.test.js).

## G10

**Business** · Board · Planned

- Two to six local/room players; Indian-city property board, buying, auctions, rent ladders, even building, mortgages, jail, cards, trades, debt and bankruptcy.
- Inspect any deed; primary decisions precede scrollable board; non-turn auction/trade responses are authorized; preserve private deck and round/revision checks.
- Preserve catalog player range 2–6; full rules/options and transitions in the cited game are the baseline.

Sources: [games/business.js](../../games/business.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: [test/business.test.js](../../test/business.test.js).

## G11

**Chess** · Board · Planned

- Local one/two-player modes and room duel; legal moves, check, castling, en passant, promotion and end conditions represented by current game.
- Preserve catalog player range 1–2; full rules/options and transitions in the cited game are the baseline.

Sources: [games/chess.js](../../games/chess.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: [test/chess-pieces.test.js](../../test/chess-pieces.test.js).

## G12

**Imposter** · Party · Planned

- Three to twenty players; 630 original prompts across 21 categories plus approved Telugu movies; Classic/Pair mode.
- Choose fixed/random imposter count bounded by table size, hint/category/fellow-imposter visibility and categories.
- Private reveal; round votes eliminate top candidate, ties spare all; crew wins at zero imposters and imposters at parity.
- Preserve catalog player range 3–20; full rules/options and transitions in the cited game are the baseline.

Sources: [games/imposter.js](../../games/imposter.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: [test/imposter.test.js](../../test/imposter.test.js).

## G13

**Mafia** · Party · Planned

- Five to ten players, rooms only; host-held roles, night actions, private information, secret votes, elimination, winning teams and recovery per existing rules.
- Preserve catalog player range 5–10; full rules/options and transitions in the cited game are the baseline.

Sources: [games/mafia.js](../../games/mafia.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: [test/mafia.test.js](../../test/mafia.test.js).

## G14

**Dumb Charades** · Party · Planned

- Two to eight players; actor/team turns, timer, categories, scoring and reveal; Telugu movies show cast/synopsis to actor and after turn.
- Preserve catalog player range 2–8; full rules/options and transitions in the cited game are the baseline.

Sources: [games/dumb-charades.js](../../games/dumb-charades.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: No dedicated test mapped; add a complete flow test before parity sign-off.

## G15

**Rock Paper Scissors** · Party · Planned

- One/two-player local modes and room duel; simultaneous hidden choices, reveal, win/draw scoring and replay.
- Preserve catalog player range 1–2; full rules/options and transitions in the cited game are the baseline.

Sources: [games/rps.js](../../games/rps.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: No dedicated test mapped; add a complete flow test before parity sign-off.

## G16

**Blackjack** · Cards · Implemented

- Solo against dealer; deck, hit, stand, double down, stakes, bust and settlement.
- Preserve catalog player range 1–1; full rules/options and transitions in the cited game are the baseline.

Sources: [games/blackjack.js](../../games/blackjack.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: No dedicated test mapped; add a complete flow test before parity sign-off.

## G17

**Crazy Eights** · Cards · Implemented

- Two players, private room or covered local handoff; suit/rank matches, wild eight suit, drawing, victory and host-owned deck.
- Preserve catalog player range 2–2; full rules/options and transitions in the cited game are the baseline.

Sources: [games/crazy-eights.js](../../games/crazy-eights.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: [test/crazy-eights.test.js](../../test/crazy-eights.test.js).

## G18

**UNO-inspired** · Cards · Implemented

- Two to twenty players, private room or local handoff; matching color/value, wilds, skip/reverse, draw penalties without stacking, one-card callouts/catches and +4 bluff challenges.
- Use two decks above ten players; host-private hands/deck and recipient-specific recovery.
- Preserve catalog player range 2–20; full rules/options and transitions in the cited game are the baseline.

Sources: [games/uno.js](../../games/uno.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: [test/uno.test.js](../../test/uno.test.js).

## G19

**Tic-Tac-Toe** · Puzzle · Implemented

- One/two-player local modes and room duel; legal cells, computer option, three-in-row win/draw and reset.
- Preserve catalog player range 1–2; full rules/options and transitions in the cited game are the baseline.

Sources: [games/tictactoe.js](../../games/tictactoe.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: No dedicated test mapped; add a complete flow test before parity sign-off.

## G20

**Connect Four** · Puzzle · Implemented

- One/two-player local modes and room duel; gravity drops, computer option, four-in-line wins/draws and full-column rejection.
- Preserve catalog player range 1–2; full rules/options and transitions in the cited game are the baseline.

Sources: [games/connect-four.js](../../games/connect-four.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: No dedicated test mapped; add a complete flow test before parity sign-off.

## G21

**Minesweeper** · Puzzle · Implemented

- Solo board settings, first-click safety, reveal/flag, loss/win and saved board.
- Preserve catalog player range 1–1; full rules/options and transitions in the cited game are the baseline.

Sources: [games/minesweeper.js](../../games/minesweeper.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: No dedicated test mapped; add a complete flow test before parity sign-off.

## G22

**Memory Match** · Puzzle · Implemented

- One/two-player matching pairs; concealed cards, delayed mismatch flips, scoring and turn progression.
- Preserve catalog player range 1–2; full rules/options and transitions in the cited game are the baseline.

Sources: [games/memory.js](../../games/memory.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: No dedicated test mapped; add a complete flow test before parity sign-off.

## G23

**2048** · Puzzle · Implemented

- Keyboard/swipe slides, once-per-move merges, staged movement/merge/spawn, score, 2048 continuation and game over.
- Preserve catalog player range 1–1; full rules/options and transitions in the cited game are the baseline.

Sources: [games/2048.js](../../games/2048.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: [test/2048.test.js](../../test/2048.test.js).

## G24

**Simon Says** · Puzzle · Implemented

- Watch growing color sequence, input phase, correct/failure feedback and timed-session resume.
- Preserve catalog player range 1–1; full rules/options and transitions in the cited game are the baseline.

Sources: [games/simon.js](../../games/simon.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: No dedicated test mapped; add a complete flow test before parity sign-off.

## G25

**Hangman** · Word · Implemented

- One/two-player word modes, keyboard/letter entry, repeated-guess handling, mistake limit and win/loss.
- Preserve catalog player range 1–2; full rules/options and transitions in the cited game are the baseline.

Sources: [games/hangman.js](../../games/hangman.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: [test/hangman.test.js](../../test/hangman.test.js).

## G26

**Word Scramble** · Word · Implemented

- Solo shuffled words, answer checking, hints, progress and timer.
- Preserve catalog player range 1–1; full rules/options and transitions in the cited game are the baseline.

Sources: [games/word-scramble.js](../../games/word-scramble.js), [js/game-catalog.js](../../js/game-catalog.js), [docs/games.md](../../docs/games.md).

Baseline tests: No dedicated test mapped; add a complete flow test before parity sign-off.
