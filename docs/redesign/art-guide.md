# Arcade artwork guide

This guide applies to **every new Arcade image**: covers, heroes, game pieces, environments and future variants. The user requires custom artwork for each game; a shared family scene is no longer an accepted game cover.

## Art direction

Use the approved [Living Game Shelf](../images/redesign-reference.png): a lively, welcoming game night expressed through tactile, stylized three-dimensional miniatures. Keep a coherent world of rounded resin pieces, painted wood, rich felt, warm table lighting and subtle coral/teal arcade rim light. Images should feel crafted and playful, not like stock photography or unrelated fantasy posters.

| Token | Color | Role |
| --- | --- | --- |
| Navy | `#191c35` | Environment, shadows, board trays |
| Coral | `#ff456b` | Energetic focal pieces and warm accent |
| Cream | `#fff3df` | Paper, cards, warm highlights |
| Teal | `#8fe0d8` | Cool focal pieces and light |
| Gold | `#ffd474` | Secondary highlights and game-specific pieces |

These anchor colors allow game-specific greens, blues, pinks and reds. Keep saturation vibrant and highlights controlled. Avoid muddy grayscale, harsh horror lighting, oversaturated neon wash, plastic-looking stock renders and inconsistent flat/vector styles.

## One identifiable subject per game

- Show the actual game's objects or activity. Show uses matching chits and a hand stack, **not a karaoke microphone**; Taboo uses clue-giving and forbidden-word cards; Imposter uses a hidden-word spy theme.
- Every catalog ID has its own full-frame landscape asset and descriptive alternative text. Do not reuse the same image under different filenames, crop unrelated family art, or mistake art coverage for a completed game port.
- Prefer a few large distinctive objects over a busy overview. Keep the essential subject in the central 60% so the same art works on a wide hero, a small shelf cover and a mobile crop.
- Use believable game pieces and legal geometry. When exact counts are unreliable in generation, use a deliberate close crop rather than showing a clearly incorrect complete board. A complete Tic-Tac-Toe board must be 3×3; an entire Connect Four board must be 7×6.
- Avoid generated UI, logos, title typography, watermarks and readable text. Game titles and controls remain accessible live HTML. Numerals or marks integral to a game piece may appear when correct and inspected.
- Artwork never substitutes for interactive boards or conveys turn/win state by itself.

## Reusable generation prompt

> A premium stylized 3D miniature illustration for Arcade's Living Game Shelf. [GAME-SPECIFIC SUBJECT AND PROPS]. Cozy tabletop arcade environment; deep navy shadows, coral and teal accent pieces, cream materials and warm golden light. Tactile rounded resin, painted wood and felt, lively crafted detail, polished game-night atmosphere. Wide landscape, one clear focal subject centered inside the middle 60%, readable at thumbnail size. Full-bleed art only: no UI, no border, no title, no logo, no watermark or readable text. Preserve the actual game's objects and avoid unrelated game props.

Each asset's final prompt and generator are recorded in [the artwork manifest](artwork-manifest.json). Prefer the Adobe connector for supported image generation, inspect its results, and use built-in ImageGen when a result cannot meet the required subject/geometry. No CLI/API-key generation is implied by a batch request.

## Acceptance and integration

1. Inspect subject correctness, geometry, palette, lighting, materials, crop and small-size readability before accepting an image.
2. Preserve downloaded originals in local scratch during inspection; commit optimized local web assets with stable game-ID filenames. Format conversion is an export step, not an unreviewed creative change.
3. Record provenance, exact prompt, dimensions, hash and inspection notes without signed download URLs or secrets.
4. Use one manifest-backed art component for hero, shelf, catalog, resume, setup and unported-game details. Preserve aspect ratio and provide fitting/crop guidance where needed.
5. Run coverage/uniqueness checks for all 26 IDs, verify real browser image loading, inspect desktop/mobile crops, and update captures after changes.
6. Keep original Arcade and third-party icon credits. Do not add external runtime image hosts.
