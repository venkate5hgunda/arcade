# Arcade

A polished, responsive **progressive web app (PWA)** hosting a lot of games —
single player, two player, board games, and group party games. Built with pure
HTML/CSS/JS (no build step), installable on desktop and mobile, with light/dark
mode, sound, and haptics.

## Game catalog

| Game | Players | Category | Status |
| --- | --- | --- | --- |
| Air Hockey | 2 | Action | ✅ Implemented |
| Whack-a-Mole | 1 | Action | ✅ Implemented |
| Snakes & Ladders | 2–4 | Board | ✅ Implemented |
| Ludo | 2–4 | Board | ✅ Implemented |
| Chess | 1–2 | Board | ✅ Implemented |
| Imposter | 3–8 | Party | ✅ Implemented |
| Dumb Charades | 2–8 | Party | ✅ Implemented |
| Rock Paper Scissors | 1–2 | Party | ✅ Implemented |
| Tic-Tac-Toe | 1–2 | Puzzle | ✅ Implemented |
| Connect Four | 1–2 | Puzzle | ✅ Implemented |
| Minesweeper | 1 | Puzzle | ✅ Implemented |
| Memory Match | 1–2 | Puzzle | ✅ Implemented |
| 2048 | 1 | Puzzle | ✅ Implemented |
| Simon Says | 1 | Puzzle | ✅ Implemented |
| Hangman | 1–2 | Word | ✅ Implemented |
| Word Scramble | 1 | Word | ✅ Implemented |

## Features

- **Responsive** — mobile, tablet, desktop. Flexible grid + fluid game stages.
- **Light / dark mode** — persists in `localStorage` and can follow the OS.
- **Sound** — synthesized Web Audio (no external assets), works offline.
- **Haptics** — uses the Vibration API when available and permitted.
- **Offline-first PWA** — service worker caches the shell and runtime assets.
- **Personalized** — cookies/web storage retain theme, sound, haptics, active
  game, player names, high scores, and per-game settings.
- **Setup flow** — every game opens with a lightweight options screen (player
  count, difficulty, mode, timer, etc.) before play starts; choices persist
  per game.
- **Recently played** — the home screen surfaces your last few games (deduped,
  most-recent-first) above the full catalog for quick re-entry.
- **Per-game "vibe"** — each game has its own accent palette/theme layered on
  top of the shared shell, so the arcade doesn't feel like one reskinned game.

## Running locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Project layout

```
arcade/
  index.html            # shell: header, theme/sound/haptics toggles, game stage
  manifest.json         # PWA manifest
  sw.js                 # service worker (offline caching)
  css/styles.css        # theme tokens + component styles
  js/
    app.js              # entry point
    storage.js          # localStorage wrapper + KEYS
    theme.js            # light/dark/auto
    audio.js            # Web Audio synthesis
    haptics.js          # Vibration wrapper + toggle UI
    game-catalog.js     # single source of truth for all games
    router.js           # hash-based router + landing grid
    game-shell.js       # shared chrome for game views
    game-utils.js       # shared board game helpers
  games/
    <game-id>.js        # one module per game: default export { render(el, game) }
  assets/
    favicon.svg, logo.svg
  CHANGELOG.md          # feature + assumption tracker
```

## Adding a new game

1. Add an entry to `GAMES` in `js/game-catalog.js` (one shape, no extras).
2. Create `games/<game-id>.js` exporting `default { render(el, game) }`.
3. Done — the landing grid and deep link `#/games/<game-id>` pick it up.

See `CHANGELOG.md` for the full history of decisions and assumptions.

## Scope notes

- **"Saving game states"** is implemented as per-game settings persistence
  (mode/difficulty/players remembered across visits) plus the Recently Played
  list — not full mid-game board resume. Closing mid-game starts a fresh round
  next time; this was a deliberate scope call to keep every game's state model
  simple and bug-free rather than adding serialization to 16 different games.
- **Chess** implements checkmate, stalemate, and insufficient-material draws,
  but not draw-by-repetition or the 50-move rule — a deliberate scope limit
  for a casual pass-and-play/AI opponent experience.
