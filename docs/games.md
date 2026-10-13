# Game catalog

All 22 games, their player counts and special options.

[← Back to the README](../README.md)

| Game | Players | Category | Status |
| --- | --- | --- | --- |
| Air Hockey | 2 | Action | ✅ Implemented |
| 8-Ball Pool | 2 | Action | ✅ Implemented |
| Whack-a-Mole | 1 | Action | ✅ Implemented |
| Snakes & Ladders | 2–4 | Board | ✅ Implemented |
| Ludo | 2–4 | Board | ✅ Implemented |
| Island Charter | 3–4 | Board | ✅ Implemented |
| Business | 2–6 | Board | ✅ Implemented |
| Chess | 1–2 | Board | ✅ Implemented |
| Imposter | 3–20 | Party | ✅ Implemented |
| Mafia | 5–10 | Party | ✅ Implemented |
| Dumb Charades | 2–8 | Party | ✅ Implemented |
| Rock Paper Scissors | 1–2 | Party | ✅ Implemented |
| Blackjack | 1 | Cards | ✅ Implemented |
| Crazy Eights | 2 | Cards | ✅ Implemented |
| UNO-inspired | 2–20 | Cards | ✅ Implemented |
| Tic-Tac-Toe | 1–2 | Puzzle | ✅ Implemented |
| Connect Four | 1–2 | Puzzle | ✅ Implemented |
| Memory Match | 1–2 | Puzzle | ✅ Implemented |
| 2048 | 1 | Puzzle | ✅ Implemented |
| Simon Says | 1 | Puzzle | ✅ Implemented |
| Hangman | 1–2 | Word | ✅ Implemented |
| Word Scramble | 1 | Word | ✅ Implemented |


### Imposter options

Imposter ships an original catalogue of 630 words across 21 categories
(`js/imposter-words.js`); each entry has a hint and a close decoy word.
Setup offers Classic or **Pair** mode (imposters secretly get the decoy and are
not told their role), an imposter slider with a **Random** switch for a
secret count within a range (1–6, at most fewer than half the table; the
slider locks live when the player count allows only one), toggles for what imposters see (category, hint, fellow
imposters), and a collapsible category picker that can mix in Telugu movies.
Games run in rounds: the top vote is eliminated, ties spare everyone, and the
crew wins once every imposter is out; imposters win when they equal the crew.

### Telugu movie catalogue

Dumb Charades and Imposter offer **Telugu movies** alongside their existing
prompt categories, drawn from the approved catalogue in `data/movies/` (see
`dev/movies/README.md`). In Dumb Charades the actor's card shows the top three
billed actors and a one-sentence summary under the title to help them mime it;
both reappear on the post-turn reveal. Imposter shows them only in the results,
never on a face-down handoff or a hidden role card. Each card credits its
source (TMDB, OMDb, Wikipedia under CC BY-SA, or the supplied dataset).
