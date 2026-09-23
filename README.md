# Arcade

A polished, responsive **progressive web app (PWA)** hosting a lot of games —
single player, two player, board games, and group party games. Built with pure
HTML/CSS/JS (no build step), installable on desktop and mobile, with light/dark
mode, sound, and haptics.

## Game catalog

| Game | Players | Category | Status |
| --- | --- | --- | --- |
| Air Hockey | 2 | Action | ✅ Implemented |
| Snakes & Ladders | 2–4 | Board | ✅ Implemented |
| Ludo | 2–4 | Board | ✅ Implemented |
| Imposter | 3–8 | Party | ✅ Implemented |
| Dumb Charades | 2–8 | Party | ✅ Implemented |
| Tic-Tac-Toe | 1–2 | Puzzle | ✅ Implemented |
| Connect Four | 1–2 | Puzzle | ✅ Implemented |
| Minesweeper | 1 | Puzzle | ✅ Implemented |
| Memory Match | 1–2 | Puzzle | ✅ Implemented |
| Hangman | 1–2 | Word | ✅ Implemented |

## Features

- **Responsive** — mobile, tablet, desktop. Flexible grid + fluid game stages.
- **Light / dark mode** — persists in `localStorage` and can follow the OS.
- **Sound** — synthesized Web Audio (no external assets), works offline.
- **Haptics** — uses the Vibration API when available and permitted.
- **Offline-first PWA** — service worker caches the shell and runtime assets.
- **Personalized** — cookies/web storage retain theme, sound, haptics, active
  game, player names, high scores, and per-game settings.

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
