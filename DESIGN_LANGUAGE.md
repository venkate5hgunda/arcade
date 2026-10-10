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
`--game-ui-primary: #245c48` for Hangman's forest-green actions. Board artwork,
textures, animation and piece styling remain game-owned. Keep foreground and
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
