# Artwork and assets

The [Living Game Shelf reference](../images/redesign-reference.png) establishes the navy, coral, cream, teal and warm golden tabletop direction. The [art guide](art-guide.md) is the required brief for every new Arcade image.

All **26 games have distinct local covers**, reused consistently on the hero, shelf, catalog, resume, setup and unported-game detail surfaces through `GameArt`. Artwork coverage is independent of gameplay migration: nine games currently have native redesigned play.

- `redesign/public/art/games/*.webp`: 26 inspected, optimized 1344×768 covers, approximately 1.96 MiB combined. The [manifest](artwork-manifest.json) records every game ID, alternative text, hash, dimensions, byte size, provider, exact accepted prompt and generation request ID.
- Twenty-five new covers were generated with Adobe Firefly. Tic-Tac-Toe retains the bespoke built-in ImageGen illustration from the first-game milestone; its original prompt was not recorded then, and the manifest explicitly preserves that limitation.
- `redesign/public/art/tictactoe-hero.png`: original retained source for the optimized Tic-Tac-Toe cover.
- `redesign/public/icons/`: existing Arcade branding and Tabler icons, copied from `assets/logo.svg` and `assets/icons/tabler/`. Existing attribution and licenses remain in [the credits](../credits.md).
- [Desktop](../images/redesign-desktop.png) and [mobile](../images/redesign-mobile.png) captures show the actual built app. [Blackjack](../images/redesign-blackjack-mobile.png) shows the new live card table.

The earlier shared six-family atlas has been retired. The user's per-game artwork requirement supersedes that temporary foundation decision. These are illustrations rather than gameplay screenshots; generated artwork never supplies live controls or game state. No external image host or runtime generation is used.

## Generator assessment

Adobe produced a coherent tactile world across game-specific prompts. Wordle was regenerated to replace rune-like glyphs; Crazy Eights was regenerated to remove contradictory corner ranks. Complete Connect Four racks remained incorrect across Adobe and built-in attempts, so the accepted cover deliberately focuses on discs beside a cropped rack edge. Generated geometry must be inspected, not inferred from prompt compliance. Exporting the accepted images as WebP preserves their visual content while reducing download size.

Inventory checks enforce distinct hashes/paths and exact catalog coverage; desktop Chromium and mobile WebKit exercise all 26 hero selections and verify image decoding and consistent catalog/detail assets.
