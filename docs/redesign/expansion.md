# New games from Todoist

Each game includes native local play and private-room multiplayer. Games remain serverless and offline-capable. Puzzle content is original and bundled; no external daily feed is used.

## Strands

Eight authored themes generate 6×8 letter grids with complete coverage and a spangram joining opposite sides. Tap adjacent letters (diagonals count), undo the last letter, submit words, and use up to three shared hints. Solo/shared-device play and 2–20-player cooperative rooms preserve found paths and hints across reload/reconnect.

Evidence: `redesign/checks/unit/challenges.check.ts`, `redesign/checks/unit/room.check.ts`, and `redesign/checks/browser/challenges.spec.ts`.

## Spelling Bee

Nine seven-letter hives use an original bundled practice vocabulary plus Arcade’s existing offline word list. The center letter is required; pangrams add seven points. Four-letter words score one and longer words their length. Genius begins at 70% of available points; finding all words earns Queen Bee. Cooperative rooms share accepted words and scores, with duplicate protection and the same host/reconnect/spectator rules.
