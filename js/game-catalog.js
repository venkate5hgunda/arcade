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
    icon: ' Hockey',
    description: 'Fast two-player air hockey on a glowing table. Slide, shoot, and defend.',
  },
  {
    id: 'snakes-ladders',
    name: 'Snakes & Ladders',
    tagline: 'Race to the finish',
    players: { min: 2, max: 4, type: 'local-multiplayer' },
    category: 'Board',
    color: '#34d399',
    icon: ' Snakes',
    description: 'Classic board race with snakes that slide you back and ladders that boost you forward.',
  },
  {
    id: 'ludo',
    name: 'Ludo',
    tagline: 'Get all tokens home',
    players: { min: 2, max: 4, type: 'local-multiplayer' },
    category: 'Board',
    color: '#fbbf24',
    icon: ' Ludo',
    description: 'The beloved family board game. Roll, race, and knock opponents back to start.',
  },
  {
    id: 'imposter',
    name: 'Imposter',
    tagline: 'Find the spy among you',
    players: { min: 3, max: 8, type: 'group' },
    category: 'Party',
    color: '#a855f7',
    icon: ' Spy',
    description: 'One player gets a secret word, everyone else gets a related clue. Blend in and deduce.',
  },
  {
    id: 'dumb-charades',
    name: 'Dumb Charades',
    tagline: 'Act it, guess it',
    players: { min: 2, max: 8, type: 'group' },
    category: 'Party',
    color: '#ec4899',
    icon: ' Act',
    description: 'Act out words and phrases without speaking. Teams race to guess before the timer runs out.',
  },
  {
    id: 'tictactoe',
    name: 'Tic-Tac-Toe',
    tagline: 'Three in a row',
    players: { min: 1, max: 2, type: 'local-multiplayer' },
    category: 'Puzzle',
    color: '#38bdf8',
    icon: ' X',
    description: 'The timeless pencil-and-paper classic. Play a friend or face the computer.',
  },
  {
    id: 'connect-four',
    name: 'Connect Four',
    tagline: 'Drop to win',
    players: { min: 1, max: 2, type: 'local-multiplayer' },
    category: 'Puzzle',
    color: '#f97316',
    icon: ' O',
    description: 'Gravity grid duel. Drop your discs and be the first to line up four.',
  },
  {
    id: 'minesweeper',
    name: 'Minesweeper',
    tagline: 'Clear the field',
    players: { min: 1, max: 1, type: 'single' },
    category: 'Puzzle',
    color: '#10b981',
    icon: ' Mine',
    description: 'Logic classic. Flag mines, reveal safe squares, and clear the board without a boom.',
  },
  {
    id: 'memory',
    name: 'Memory Match',
    tagline: 'Pairs in the dark',
    players: { min: 1, max: 2, type: 'local-multiplayer' },
    category: 'Puzzle',
    color: '#e11d48',
    icon: ' Cards',
    description: 'Flip face-down cards and pair them up. Lowest mismatch count wins.',
  },
  {
    id: 'hangman',
    name: 'Hangman',
    tagline: 'Guess the word',
    players: { min: 1, max: 2, type: 'local-multiplayer' },
    category: 'Word',
    color: '#6366f1',
    icon: ' Word',
    description: 'Guess letters one at a time. Too many wrong steps and the hanger finishes.',
  },
];

export const CATEGORIES = ['All', 'Action', 'Board', 'Party', 'Puzzle', 'Word'];

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
  } catch {
    return null;
  }
}
