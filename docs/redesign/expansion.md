# New games from Todoist

The production shelf now has 34 games, including the eight Todoist additions. Each addition includes native local play and private-room multiplayer. Games remain serverless and offline-capable. Puzzle content is original and bundled; no external daily feed is used.

## Connections

Connections shipped first in PR #21. It includes 24 original grouped-word sets, solo/shared-device play, and 2–20-player cooperative rooms. See [its implementation notes](connections.md).

## Strands

Eight authored themes generate 6×8 letter grids with complete coverage and a spangram joining opposite sides. Tap adjacent letters (diagonals count), undo the last letter, submit words, and use up to three shared hints. Solo/shared-device play and 2–20-player cooperative rooms preserve found paths and hints across reload/reconnect.

Evidence: `redesign/checks/unit/challenges.check.ts`, `redesign/checks/unit/room.check.ts`, and `redesign/checks/browser/challenges.spec.ts`.

## Spelling Bee

Nine seven-letter hives use an original bundled practice vocabulary plus Arcade’s existing offline word list. The center letter is required; pangrams add seven points. Four-letter words score one and longer words their length. Genius begins at 70% of available points; finding all words earns Queen Bee. Cooperative rooms share accepted words and scores, with duplicate protection and the same host/reconnect/spectator rules.

## Letter Boxed

Six original layouts each have a verified two-word solution, with side rotations for daily/practice variation. Words must use different sides for consecutive letters and begin with the previous word’s last letter. Any legal chain covering all twelve letters wins. Local play and cooperative rooms share the chain and support undo; the offline dictionary is intentionally bounded.

## Mini Crossword

Eight original 5×5 word-square crosswords have distinct Across/Down clues. Entries, optional revealed letters and completion survive reload. Check letters provides local feedback without modifying the grid. Cooperative rooms serialize edits against the current revision; stale concurrent edits cannot overwrite newer entries. Revealed cells remain fixed and assistance is displayed.

## Tiles

Twelve generated tiles each carry three independently matchable layers. Matching a ring, shape or pattern removes every shared layer; carrying a remaining tile forward grows the combo. Even pattern counts guarantee a path to clearing the tray. One-device multiplayer and rooms enforce turns after valid matches, share the score, and validate the complete move history on restore.

## Sudoku

Deterministic on-device generation randomizes a valid solution and removes clues only while a solver confirms one unique solution. Easy/medium/hard target 40/33/27 givens, with uniqueness taking precedence over the target. These tiers describe clue density rather than a rating of human solving techniques. Values, pencil notes, revealed cells and difficulty survive reload. Cooperative rooms share editing, reject stale revisions and preserve the selected difficulty on replay.

## Quoridor

Two players race pawns on a 9×9 board with ten walls each. Orthogonal moves, straight jumps and blocked-jump sidesteps follow the board rules. Walls cannot cross or overlap; BFS validates a path to both goal edges after every proposed wall. Local play and head-to-head rooms enforce seats, turns, stock and winner accounting. Wall placement has an explicit preview and confirmation. A solo AI is not included.

## Shared delivery and recovery

The six cooperative additions support 2–20 room players; Quoridor requires exactly two. Selections stay local, while accepted actions are validated by the host against the round, revision and active seat. Spectators receive public state and cannot act. Player disconnects pause play, spectator disconnects do not, and tab-scoped host backups restore exact game progress. Solo/local checkpoints retain the common saved-session envelope with a 24-hour inactivity expiry.

Protocol v11 rejects older invitation links with reload guidance and restores valid v1–v10 host backups using fresh invitations. The original 26-game source inventory remains frozen; requirements G27–G34 describe the additions. All new covers are distinct inspected local assets in the [artwork manifest](artwork-manifest.json).

Automated evidence includes complete seeded rule runs, unique Sudoku solutions, Quoridor path/geometry checks, all-game spectator/20-seat tests, and actual desktop Chromium/mobile WebKit room synchronization with host reload. Browser tests also exercise narrow 320px layouts, original game aliases, accessibility and the complete offline asset graph. Physical-device installation, camera/audio/haptic behavior and separate-network connectivity retain the existing [release limitations](release-qualification.md).

## Captured game states

Captured from the production build in desktop Chromium and mobile WebKit. These show restored progress or a completed game after the rule and recovery checks.

| Game | Desktop | Mobile |
| --- | --- | --- |
| Strands | [Capture](../images/arcade-strands-desktop.png) | [Capture](../images/arcade-strands-mobile.png) |
| Spelling Bee | [Capture](../images/arcade-spelling-bee-desktop.png) | [Capture](../images/arcade-spelling-bee-mobile.png) |
| Letter Boxed | [Capture](../images/arcade-letter-boxed-desktop.png) | [Capture](../images/arcade-letter-boxed-mobile.png) |
| Mini Crossword | [Capture](../images/arcade-mini-crossword-desktop.png) | [Capture](../images/arcade-mini-crossword-mobile.png) |
| Tiles | [Capture](../images/arcade-tiles-desktop.png) | [Capture](../images/arcade-tiles-mobile.png) |
| Sudoku | [Capture](../images/arcade-sudoku-desktop.png) | [Capture](../images/arcade-sudoku-mobile.png) |
| Quoridor | [Capture](../images/arcade-quoridor-desktop.png) | [Capture](../images/arcade-quoridor-mobile.png) |

## Word tracing presentation

The supplied NYT Games screen recording shows Strands. The existing native game now supports drag-to-trace and release-to-submit alongside tap, keyboard and explicit submission. SVG paths show active selections, accepted words and the gold spangram. Letter Boxed shows draft and accepted chains; word badges enter with a short animation. Reduced motion disables these transitions. Existing offline puzzles, rules and checkpoint formats remain unchanged.

Validation for this presentation change: root tests, redesign inventory/domain tests, formatting and production build pass. Four focused desktop browser checks pass, covering tap/keyboard-compatible selection, hints, completion, drag submission, persisted paths, Letter Boxed chains and accessibility. The mobile WebKit checks cannot launch in this workspace because required system libraries are missing; mobile-device animation behavior remains unverified.

## Editorial interface and minimal game UX

The expanded request applies the recording’s design principles across Arcade, rather than copying its branding or puzzle content. `redesign/src/editorial.css` is the final shared presentation layer: restrained surfaces, typography, hairline borders, pill controls, semantic board colors and compact phone layouts. It removes ornamental table gradients, keeps distinct existing artwork and leaves actual board/canvas physics intact. The existing game-specific motion is retained, with staggered word reveals and short press feedback added under reduced-motion guards.

`GameMenu` uses native modal dialogs for rules, room options, player details and private game records. The browser traps focus; Escape, Close and backdrop dismissal restore the trigger. Contents mount only while open. Essential scores, turns, errors and result messages remain on the game screen. Generic setup descriptions and redundant explanatory footers are removed from the primary flow. Instructions and room-entry controls remain available in menus.

Regression coverage: `redesign/checks/browser/editorial.spec.ts` checks the entire game catalog at phone width and exercises modal help, focus containment, Escape and focus restoration. The existing game suites retain functional and room coverage.

Final editorial validation: production build, formatting, root tests (31), redesign inventory (5) and domain tests (114) pass. The broad desktop browser run and correction reruns cover 137 scenarios, with three existing platform-specific skips. Final phone-width accessibility, popup focus and spectator checks pass. Native WebKit remains blocked by missing system libraries. See the root `design-qa.md` for evidence and limitations.

Compact phone matches use the persistent Arcade home link to exit, avoiding a duplicate back row above the board. Navigation and all-game phone-width checks exercise that visible control, including keyboard activation outside the Pool table.

Mobile release CI found a role-dependent Mafia contrast gap: dark legacy panels conflicted with the shared light control text. Hero and action panels now use the shared surface/ink tokens, while the private role card retains its distinct dark treatment. The five-browser test checks accessibility for every role instead of whichever role the host happens to receive.
