// Three illustrated moves plus the controls, choices and goal for every cabinet.
export const GAME_HELP = {
  '2048': { steps: [['⬅️', 'Slide', 'Swipe or press an arrow: every tile moves to the edge.'], ['2 + 2', 'Merge', 'Equal tiles collide once per move and double in value.'], ['✨', 'New tile', 'A 2 or 4 appears in an empty square after a successful move.']], controls: 'Swipe or use arrow keys. Empty space is needed to move.', options: 'Keep Going after 2048, or start a new board.', goal: 'Build a 2048 tile without filling the board with no legal merges.' },
  'air-hockey': { steps: [['🏒', 'Faceoff', 'The puck stays at center until either player hits it with their paddle.'], ['●', 'Strike', 'The table slows light taps quickly. Swipe firmly for a fast shot; angle your hit toward the opposite goal.'], ['⚑', 'Serve', 'After a goal, the puck rests on the other player’s half until struck.']], controls: 'Drag on the table; P1 (bottom) can use arrows, P2 (top) WASD.', options: 'Choose a winning score of 5, 7 or 10.', goal: 'Be the first to reach the chosen score.' },
  blackjack: { steps: [['🂠', 'Deal', 'You and the dealer receive two cards; one dealer card stays hidden.'], ['+', 'Choose', 'Hit for another card, stand, or double down for one final card.'], ['21', 'Compare', 'The dealer draws until 17; getting above 21 busts.']], controls: 'Use Hit, Stand or Double buttons.', options: 'Double raises the stake. Aces count as 1 or 11; dealer stands on soft 17.', goal: 'Finish closer to 21 than the dealer without busting.' },
  catan: { steps: [['⬡', 'Settle', 'Place two outposts and roads in snake order; the second outpost grants nearby resources.'], ['⚄', 'Gather', 'Roll two dice to produce resources. On seven, large hands discard and the raider moves.'], ['★', 'Expand', 'Trade, build paths and outposts, grow cities and play discoveries.']], controls: 'Tap marked junctions, paths or land, then use the trade and discovery panels. In local play, pass the device before revealing your private cargo.', options: '3–4 local or room players. Harbors improve bank exchange; discoveries, longest trail and largest patrol contribute to victory.', goal: 'Reach ten points on your turn. Island Charter uses original visuals and wording around classic hex-settlement rules.' },
  chess: { steps: [['♟', 'Select', 'Tap one of your pieces to see legal destination squares.'], ['↗', 'Move', 'Tap a highlighted square; pieces have different movement patterns.'], ['♚', 'Checkmate', 'Threaten the king so it has no legal escape.']], controls: 'Tap a piece, then a highlighted square. Choose a promotion piece when a pawn reaches the far side.', options: 'Pass and play, or play the computer as White or Black. Castling and en passant follow chess rules.', goal: 'Checkmate the opposing king. Stalemate and insufficient material are draws.' },
  'connect-four': { steps: [['↓', 'Drop', 'Tap a column; your disc falls to the lowest empty slot.'], ['●●', 'Build', 'Plan ahead and block the other player.'], ['●●●●', 'Connect', 'Four in a row can be horizontal, vertical or diagonal.']], controls: 'Tap an available column.', options: 'Play a friend, the computer or your active room opponent.', goal: 'Connect four discs before your opponent.' },
  'crazy-eights': { steps: [['🂠', 'Deal', 'In a room, each player sees only their own hand; local play uses a private handoff.'], ['8', 'Match', 'Play the same suit or rank; an eight changes the active suit.'], ['↗', 'Draw', 'Draw once, then play or pass to the other player.']], controls: 'Tap a playable card or draw; choose a suit after a wild eight.', options: 'Two players in a private room or optional local pass and play.', goal: 'Empty your hand first, or have fewer penalty points if blocked.' },
  'dumb-charades': { steps: [['🎭', 'Act', 'Pass the device to the actor and secretly read the prompt.'], ['⏱', 'Guess', 'Act silently while teammates guess before time runs out.'], ['✓', 'Score', 'Mark guessed or skip, then switch teams.']], controls: 'Use Show Word, Guessed It, Skip and Next Turn.', options: 'Choose players, 30–90-second timer and classic or Telugu-movie prompts.', goal: 'The team with more correct guesses wins.' },
  hangman: { steps: [['_ _ _', 'Reveal', 'A secret word has hidden letters.'], ['A', 'Guess', 'Choose letters to reveal every occurrence.'], ['✕', 'Limit', 'Wrong guesses draw the figure.']], controls: 'Tap letters on the on-screen keyboard.', options: 'Choose solo or two-player turns.', goal: 'Reveal the word before the figure is complete.' },
  imposter: { steps: [['🕵', 'Secret', 'Everyone views their own card privately; one player is the imposter.'], ['💬', 'Discuss', 'Give subtle clues without saying the word.'], ['🗳', 'Vote', 'Vote separately for the imposter, then reveal the result.']], controls: 'Pass the device face down; tap Show My Card, then vote.', options: 'Choose 3–8 players and everyday words or Telugu movies.', goal: 'Catch the imposter; the imposter tries to blend in.' },
  ludo: { steps: [['⚀', 'Roll six', 'A six releases a token from the yard.'], ['↻', 'Race', 'Choose a glowing legal token; forced moves happen automatically.'], ['★', 'Home', 'Capture opponents on unsafe squares and reach home exactly.']], controls: 'Tap the die, then a glowing token if there is a choice.', options: 'Choose 2–4 players; supports local play or room seats.', goal: 'Get all four tokens home first.' },
  memory: { steps: [['?', 'Flip', 'Turn over one card, then a second.'], ['≡', 'Match', 'Identical symbols stay face up.'], ['🏆', 'Finish', 'Find all pairs with as few misses as you can.']], controls: 'Tap two facedown cards each turn.', options: 'Choose grid size and solo or two-player turns.', goal: 'In solo, uncover all pairs; in two-player play, find more pairs.' },
  minesweeper: { steps: [['□', 'Reveal', 'Tap a square; numbers count adjacent mines.'], ['🚩', 'Flag', 'Mark a suspected mine instead of revealing it.'], ['✓', 'Clear', 'Use the numbers to uncover every safe square.']], controls: 'Tap to reveal; use flag mode on touch or right-click to flag.', options: 'Choose board difficulty and toggle flag mode.', goal: 'Reveal every safe square without opening a mine.' },
  pool: { steps: [['🎱', 'Break', 'Aim the cue and strike the racked balls.'], ['1–7', 'Clear', 'Pocket your solids or stripes under the house rules.'], ['8', 'Finish', 'Pocket the eight only after your group is cleared.']], controls: 'Drag to aim and shoot; adjust power with the slider, or use arrow keys.', options: 'Two local players; first claimed group becomes yours. Fouls pass the turn.', goal: 'Legally pocket the eight ball after clearing your group.' },
  rps: { steps: [['✊', 'Choose', 'Select rock, paper or scissors in secret.'], ['3…2…1', 'Reveal', 'Watch the countdown before hands are shown.'], ['✌️', 'Score', 'Rock beats scissors, scissors beat paper, paper beats rock.']], controls: 'Tap a hand; pass the device for a local friend.', options: 'Choose computer or friend and a first-to-3, 5 or 7 target.', goal: 'Win enough rounds to reach the target.' },
  simon: { steps: [['🔴', 'Watch', 'Observe the lit pad sequence.'], ['🟢', 'Repeat', 'Tap the pads in the same order.'], ['➕', 'Grow', 'Each successful round adds another step.']], controls: 'Tap the colored pads after the sequence finishes.', options: 'Choose sequence speed in setup.', goal: 'Remember the longest sequence you can; a mistake ends the run.' },
  'snakes-ladders': { steps: [['⚀', 'Roll', 'Tap the die and advance your token.'], ['🪜', 'Climb', 'Ladders send you upward; snakes slide you down.'], ['100', 'Finish', 'Land exactly on square 100.']], controls: 'Tap the die on your turn; movement is automatic.', options: 'Choose 2–4 players locally or assign room seats; each new board varies.', goal: 'Reach square 100 before the other players.' },
  tictactoe: { steps: [['X', 'Place', 'Tap an empty square to mark it.'], ['O', 'Alternate', 'The other player or computer takes a turn.'], ['XXX', 'Align', 'Complete a row, column or diagonal of three.']], controls: 'Tap an empty square.', options: 'Play a friend, the computer or your active room opponent.', goal: 'Make three in a line before your opponent.' },
  uno: { steps: [['🌈', 'Match', 'Play a card matching the active color or top value.'], ['+2', 'Action', 'Skip, reverse and draw cards change the next turn.'], ['★', 'Wild', 'Choose a color; challenge a +4 bluff, or call UNO when one card remains.']], controls: 'Room players see only their own cards; in optional local play, reveal only your hand. Tap a playable card, or draw once and play only that card or pass.', options: '2–4 players in a private room or optional local pass and play. A missed UNO can be caught for +2; a failed +4 challenge costs 6. Draw cards do not stack; multi-round point scoring is not included.', goal: 'Empty your hand; a blocked game goes to the fewest cards.' },
  'whack-a-mole': { steps: [['🐹', 'Spot', 'Watch for a mole to pop up.'], ['👆', 'Whack', 'Tap quickly before it hides.'], ['⏱', 'Score', 'Keep landing hits until the timer runs out.']], controls: 'Tap the active hole.', options: 'Choose a 30, 45 or 60-second round.', goal: 'Beat your personal best score.' },
  'word-scramble': { steps: [['A B C', 'Unscramble', 'Rearrange the displayed letters into a word.'], ['💡', 'Hint', 'Ask for the starting letter if you need help.'], ['✓', 'Submit', 'Type a guess or skip and try the next word.']], controls: 'Type an answer, then select Guess; Hint and Skip are optional.', options: 'Choose round count in setup.', goal: 'Solve as many words as you can.' },
};

export function openGameHelp(id) {
  const help = GAME_HELP[id];
  if (!help) throw new Error(`No instructions for ${id}.`);
  document.querySelector('.game-help-dialog[open]')?.close();
  const dialog = document.createElement('dialog');
  dialog.className = 'game-help-dialog';
  const heading = document.createElement('h2');
  heading.textContent = 'How to play';
  const steps = document.createElement('ol');
  steps.className = 'game-help-steps';
  for (const [icon, label, description] of help.steps) {
    const item = document.createElement('li');
    const image = document.createElement('span');
    image.className = 'game-help-illustration';
    image.setAttribute('aria-hidden', 'true');
    image.textContent = icon;
    const text = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = label;
    const body = document.createElement('p');
    body.textContent = description;
    text.append(title, body);
    item.append(image, text);
    steps.append(item);
  }
  const details = document.createElement('div');
  for (const [label, value] of [['Controls', help.controls], ['Options', help.options], ['Goal', help.goal]]) {
    const paragraph = document.createElement('p');
    const bold = document.createElement('strong');
    bold.textContent = `${label}: `;
    paragraph.append(bold, document.createTextNode(value));
    details.append(paragraph);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Got it · Play';
  close.addEventListener('click', () => dialog.close());
  dialog.append(heading, steps, details, close);
  document.body.appendChild(dialog);
  const onNavigate = () => dialog.close();
  window.addEventListener('hashchange', onNavigate, { once: true });
  dialog.addEventListener('close', () => {
    window.removeEventListener('hashchange', onNavigate);
    dialog.remove();
  }, { once: true });
  dialog.showModal();
}
