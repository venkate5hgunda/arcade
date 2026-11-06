# Arcade game interfaces

**One arcade, different worlds.** Share the interface grammar, not the playfield.
Business keeps its illustrated cities, card games keep their felt tables, and
Hangman keeps its garden and chalk drawing.

## Shared chrome

`css/game-interface.css` defines scoped `--game-ui-*` tokens on `.game-shell`.
The shell supplies the game's catalog accent; theme-aware ink, muted text,
panels, borders and insets inherit Arcade's light/dark palette. Define aliases
on the shell, not `:root`, so they resolve each game's accent correctly.

Use `game-ui-action` for commands and add `game-ui-action--secondary` for
lower-priority commands. Use `game-ui-panel` for interface sections. These
classes are opt-in: never apply them automatically to board cells, cards,
pieces or canvas controls. Shared setup and navigation follow the same grammar.

- System sans-serif headings and labels; decorative typography belongs in art.
- Rounded panels and controls, clear focus rings and 44px minimum action targets.
- A readable primary action, quiet secondary actions and visible disabled states.
- Neutral interface surfaces; game color and artwork provide personality.
- Native expandable sections for configuration, clues, help and auxiliary tools.
- Put the next meaningful action first, including on narrow screens.

## Theme flexibility

Games can override the tokens on their own shell class, for example
`--game-ui-primary: #245c48` for Hangman's forest-green actions. Distinct board artwork and textures remain game-owned. Reuse shared components for the same physical pieces: standard playing cards use `js/playing-cards.js` and `css/card-games.css`, dice use `js/dice.js`, board tokens use `js/board-tokens.js`, and draw and discard stacks use `js/card-pile.js` and `css/card-pile.css`. Draw piles show card backs; only public discard tops are face up. Keep their appearance and behavior consistent across games; game-specific pieces such as UNO cards can have their own faces. Keep foreground and
background overrides paired; primary text requires at least 4.5:1 contrast,
and focus must remain distinguishable in both themes.

Business aliases its existing `--bs-*` interface colors to the shared tokens.
Its neutral turn panel follows Roll → Resolve → Finish; optional tasks replace
that panel rather than stacking tool accordions below the board. Property
management selects a deed before showing legal actions, and trading selects
a partner, sets terms and reviews the offer. District illustrations, skyline
board, crest, deeds and medallions remain distinct. Hangman uses the same panel/action grammar around its original
word-garden artwork, responsive letter tiles and chalk progress drawing.

## Interaction and accessibility

Explain the current player and available action rather than showing every
possible command. Keep optional clues collapsed and do not reveal secret values
through accessibility labels before gameplay reveals them.

Physical keyboard shortcuts must respect text entry and open dialogs. Restore
usable focus after disabling a selected control. Announce guess outcomes and
remaining misses; do not rely on color alone. Honor reduced motion and keep
essential art, styles and engine modules in the offline precache.

## Play inside the viewport

- **Use game controls for game moves.** Prefer tappable letters, tiles, cards,
  pieces, targets and labeled choices over asking players to type a constrained
  answer. Wordle uses a letter keyboard with Guess and Delete in the same
  cluster; Word Scramble lets players tap the actual shuffled tiles. Show the
  pending move where it will be played. Hangman needs only its letter buttons.
- **Keep the phone keyboard out of active play.** Do not mount or focus an
  editable field for an action that has game controls. Keep ordinary inputs
  for genuinely free text, such as names, catalog search and room links, and
  keep those in setup or auxiliary tools. On desktop, provide physical-key
  equivalents for efficient play, without intercepting shortcuts, focus
  navigation, or normal activation of a focused control.
- **Design for the first playable viewport.** After Start or Resume, show the
  current state and the full play surface and essential controls when they fit
  at usable sizes. Try 320 × 568 and 390 × 664 CSS pixels, with browser chrome
  accounted for. Keep keys at least 44px high, keep compact keyboard columns
  at least 24px wide, and don't make a player scroll to submit. Keep rules,
  setup, records, and secondary navigation out of the space needed to play.
- **Prioritize the next move on larger tables.** When the whole game cannot fit,
  put the next decision or private handoff above the fold. Let the board, hand,
  or roster scroll or pan in its own area where appropriate. Keep turn text,
  touch target size, zoom, and keyboard access usable. Don't crop content or
  force-scroll on every state change. Starting from a scrolled setup can return
  the view to play once; opening a clue or receiving a remote update should
  not move the player away from the controls they are using.

Apply the rule by game mechanic:

| Games | Primary controls and viewport priority |
| --- | --- |
| Wordle, Word Scramble, Hangman | Visible answer or word, letter controls, and submit/undo where needed |
| Tic-Tac-Toe, Connect Four, 2048, Memory, Minesweeper, Simon, Chess | Direct board or pad input; keep a standard-size board in view where possible, with local scrolling for larger fields |
| Air Hockey, Pool, Whack-a-Mole, Rock Paper Scissors | Table gestures, hit targets or throw buttons, with score and any essential action nearby |
| Blackjack, Crazy Eights, UNO | Current hand, action buttons and private reveal before auxiliary table information |
| Snakes & Ladders, Ludo, Island Charter, Business | Current roll, placement, or turn decision ahead of a larger inspectable board |
| Imposter, Dumb Charades, Show, Taboo, Mafia | Current handoff, prompt, timed action or ballot; show only the information allowed for that player |

Verify touch start, the first action, an error or blocked state, and exit in a
phone browser. Also verify physical keyboard entry and focus on desktop.
