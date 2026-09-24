// Game catalog — the single source of truth for every game in Arcade.
// Each entry declares metadata + a loader. The router uses this to mount the
// active game's module into the stage. Adding a new game = add one entry here
// and create the matching `games/<id>.js` module. KISS: one shape, no extras.

export const GAMES = [
  {
    id: 'air-hockey',
    name: 'Air Hockey',
    tagline: 'Two-player puck battle',
    players: { min: 2, max: 2, type: 'local-multiplayer' },
    category: 'Action',
    color: '#ff5a3c',
    icon: '🏒',
    description: 'Fast two-player air hockey on a glowing table. Slide, shoot, and defend.',
  },
  {
    id: 'pool',
    name: '8-Ball Pool',
    tagline: 'Line up the perfect shot',
    players: { min: 2, max: 2, type: 'local-multiplayer' },
    category: 'Action',
    color: '#14b8a6',
    icon: '🎱',
    description: 'Rack the balls, aim the cue and clear your group in a physical two-player match.',
  },
  {
    id: 'whack-a-mole',
    name: 'Whack-a-Mole',
    tagline: 'Tap fast, beat the clock',
    players: { min: 1, max: 1, type: 'single' },
    category: 'Action',
    color: '#84cc16',
    icon: '🔨',
    description: 'Moles pop up at random. Whack as many as you can before time runs out.',
  },
  {
    id: 'snakes-ladders',
    name: 'Snakes & Ladders',
    tagline: 'Race to the finish',
    players: { min: 2, max: 4, type: 'local-multiplayer' },
    category: 'Board',
    color: '#34d399',
    icon: '🐍',
    description: 'Classic board race with snakes that slide you back and ladders that boost you forward.',
  },
  {
    id: 'ludo',
    name: 'Ludo',
    tagline: 'Get all tokens home',
    players: { min: 2, max: 4, type: 'local-multiplayer' },
    category: 'Board',
    color: '#fbbf24',
    icon: '🎲',
    description: 'The beloved family board game. Roll, race, and knock opponents back to start.',
  },
  {
    id: 'chess',
    name: 'Chess',
    tagline: 'The ultimate strategy game',
    players: { min: 1, max: 2, type: 'local-multiplayer' },
    category: 'Board',
    color: '#c9a24b',
    icon: '♟️',
    description: 'Full rules chess with check, checkmate, castling, en passant, and promotion. Play a friend or the computer.',
  },
  {
    id: 'imposter',
    name: 'Imposter',
    tagline: 'Find the spy among you',
    players: { min: 3, max: 8, type: 'group' },
    category: 'Party',
    color: '#a855f7',
    icon: '🕵️',
    description: 'One player gets a secret word, everyone else gets a related clue. Blend in and deduce.',
  },
  {
    id: 'dumb-charades',
    name: 'Dumb Charades',
    tagline: 'Act it, guess it',
    players: { min: 2, max: 8, type: 'group' },
    category: 'Party',
    color: '#ec4899',
    icon: '🎭',
    description: 'Act out words and phrases without speaking. Teams race to guess before the timer runs out.',
  },
  {
    id: 'rps',
    name: 'Rock Paper Scissors',
    tagline: 'Best of, quick match',
    players: { min: 1, max: 2, type: 'local-multiplayer' },
    category: 'Party',
    color: '#f43f5e',
    icon: '✊',
    description: 'The timeless hand-game showdown. Play a friend pass-and-play or battle the computer.',
  },
  {
    id: 'blackjack',
    name: 'Blackjack',
    tagline: 'Beat the house to 21',
    players: { min: 1, max: 1, type: 'single' },
    category: 'Cards',
    color: '#d4ad63',
    icon: '♠️',
    description: 'Hit, stand or double down at the felt table. Closest to 21 beats the dealer.',
  },
  {
    id: 'crazy-eights',
    name: 'Crazy Eights',
    tagline: 'Match suits, turn the tables',
    players: { min: 2, max: 2, type: 'local-multiplayer' },
    category: 'Cards',
    color: '#8b5cf6',
    icon: '🃏',
    description: 'Pass-and-play card duel. Match the rank or suit, or change the game with a wild eight.',
  },
  {
    id: 'uno',
    name: 'UNO-inspired',
    tagline: 'Match colors, change direction',
    players: { min: 2, max: 4, type: 'local-multiplayer' },
    category: 'Cards',
    color: '#ef4444',
    icon: '🌈',
    description: 'Play locally or in a private room. Match colors and numbers, skip, reverse, and go wild.',
  },
  {
    id: 'tictactoe',
    name: 'Tic-Tac-Toe',
    tagline: 'Three in a row',
    players: { min: 1, max: 2, type: 'local-multiplayer' },
    category: 'Puzzle',
    color: '#38bdf8',
    icon: '❌',
    description: 'The timeless pencil-and-paper classic. Play a friend or face the computer.',
  },
  {
    id: 'connect-four',
    name: 'Connect Four',
    tagline: 'Drop to win',
    players: { min: 1, max: 2, type: 'local-multiplayer' },
    category: 'Puzzle',
    color: '#f97316',
    icon: '🔴',
    description: 'Gravity grid duel. Drop your discs and be the first to line up four.',
  },
  {
    id: 'minesweeper',
    name: 'Minesweeper',
    tagline: 'Clear the field',
    players: { min: 1, max: 1, type: 'single' },
    category: 'Puzzle',
    color: '#10b981',
    icon: '💣',
    description: 'Logic classic. Flag mines, reveal safe squares, and clear the board without a boom.',
  },
  {
    id: 'memory',
    name: 'Memory Match',
    tagline: 'Pairs in the dark',
    players: { min: 1, max: 2, type: 'local-multiplayer' },
    category: 'Puzzle',
    color: '#e11d48',
    icon: '🃏',
    description: 'Flip face-down cards and pair them up. Lowest mismatch count wins.',
  },
  {
    id: '2048',
    name: '2048',
    tagline: 'Slide, merge, reach 2048',
    players: { min: 1, max: 1, type: 'single' },
    category: 'Puzzle',
    color: '#edc22e',
    icon: '🔢',
    description: 'Slide numbered tiles with arrow keys or swipes. Merge matching tiles to reach 2048.',
  },
  {
    id: 'simon',
    name: 'Simon Says',
    tagline: 'Watch, remember, repeat',
    players: { min: 1, max: 1, type: 'single' },
    category: 'Puzzle',
    color: '#3b82f6',
    icon: '🔴',
    description: 'A color sequence grows each round. Watch closely and repeat it back exactly.',
  },
  {
    id: 'hangman',
    name: 'Hangman',
    tagline: 'Guess the word',
    players: { min: 1, max: 2, type: 'local-multiplayer' },
    category: 'Word',
    color: '#6366f1',
    icon: '🔤',
    description: 'Guess letters one at a time. Too many wrong steps and the hanger finishes.',
  },
  {
    id: 'word-scramble',
    name: 'Word Scramble',
    tagline: 'Unscramble the word',
    players: { min: 1, max: 1, type: 'single' },
    category: 'Word',
    color: '#0ea5e9',
    icon: '🔠',
    description: 'Letters shuffled, meaning hidden. Race to unscramble as many words as you can.',
  },
];

export const CATEGORIES = ['All', 'Action', 'Board', 'Cards', 'Party', 'Puzzle', 'Word'];

export function getGame(id) {
  return GAMES.find((g) => g.id === id);
}

export function gamesByCategory(category) {
  return category && category !== 'All' ? GAMES.filter((g) => g.category === category) : GAMES;
}

export function playerLabel(game) {
  const p = game.players;
  if (p.type === 'single') return 'Single player';
  if (p.type === 'group') return `${p.min}–${p.max} players`;
  return `${p.min}–${p.max} players`;
}

// Dynamically import a game module. Returns null if the module is missing
// (game not yet implemented) so the router can render a "coming soon" screen.
export async function loadGameModule(id) {
  try {
    const mod = await import(`../games/${id}.js`);
    return mod.default || mod;
  } catch (err) {
    console.error(`Failed to load game module "${id}"`, err);
    return null;
  }
}
