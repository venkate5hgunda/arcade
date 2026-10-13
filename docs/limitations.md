# Scope notes and limitations

Deliberate rule simplifications and platform constraints.

[← Back to the README](../README.md)

- A direct game link opens that game, even without a saved round. Refreshing
  on home stays on home even if other games have unfinished local rounds;
  their resume banners let you choose when to return.
- **Chess** implements checkmate, stalemate, and insufficient-material draws,
  but not draw-by-repetition or the 50-move rule — a deliberate scope limit
  for a casual pass-and-play/AI opponent experience.
- **Pool** uses simplified 8-ball house rules; there is no called pocket or
  tournament break requirement.
- **UNO-inspired** uses a single-round house ruleset: number-only opening
  card and no draw-card stacking or multi-round point scoring.
  If nobody can draw or play, the fewest cards wins (ties remain ties).
