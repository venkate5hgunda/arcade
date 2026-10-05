const GROUPS = [
  ['Games', ['ARCADE', 'PUZZLE', 'GAME', 'PLAYER', 'WINNER', 'CHAMPION', 'VICTORY', 'CHALLENGE',
    'STRATEGY', 'TACTICS', 'SKILL', 'LUCK', 'DICE', 'CARD', 'BOARD', 'PIECE']],
  ['Shapes', ['SQUARE', 'CIRCLE', 'TRIANGLE', 'DIAMOND', 'HEXAGON', 'OCTAGON', 'POLYGON']],
  ['Technology', ['COMPUTER', 'KEYBOARD', 'MOUSE', 'SCREEN', 'BROWSER', 'INTERNET', 'NETWORK',
    'JAVASCRIPT', 'PYTHON', 'RUST', 'GOLANG', 'HTML', 'CSS', 'REACT', 'VUE']],
  ['Nature', ['MOUNTAIN', 'RIVER', 'OCEAN', 'FOREST', 'DESERT', 'ISLAND', 'VOLCANO']],
  ['Space', ['GALAXY', 'PLANET', 'STAR', 'COMET', 'ASTEROID', 'NEBULA', 'UNIVERSE']],
  ['Music', ['MUSIC', 'MELODY', 'RHYTHM', 'HARMONY', 'SYMPHONY', 'CONCERT', 'INSTRUMENT']],
  ['Art', ['PAINTING', 'SCULPTURE', 'CANVAS', 'BRUSH', 'COLOR', 'PALETTE', 'ARTIST']],
  ['Science', ['SCIENCE', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'ASTRONOMY', 'GEOLOGY']],
  ['History', ['HISTORY', 'ANCIENT', 'MEDIEVAL', 'RENAISSANCE', 'EMPIRE', 'KINGDOM']],
  ['Mysteries', ['MYSTERY', 'DETECTIVE', 'CLUE', 'EVIDENCE', 'SUSPECT', 'ALIBI', 'CASE']],
];

export const HANGMAN_WORDS = Object.freeze(GROUPS.flatMap(([, words]) => words));
export const MAX_MISSES = 6;

export function wordCategory(word) {
  const group = GROUPS.find(([, words]) => words.includes(word));
  if (!group) throw new Error('Unknown Hangman word.');
  return group[0];
}

export function validHangmanState(s) {
  return Boolean(s && typeof s === 'object' && !Array.isArray(s) &&
    ['1', '2'].includes(s.players) && HANGMAN_WORDS.includes(s.word) &&
    Array.isArray(s.guessed) && s.guessed.every(ch => typeof ch === 'string' && /^[A-Z]$/.test(ch)) &&
    new Set(s.guessed).size === s.guessed.length &&
    Number.isInteger(s.wrong) && s.wrong >= 0 && s.wrong < MAX_MISSES &&
    s.wrong === s.guessed.filter(ch => !s.word.includes(ch)).length &&
    ![...s.word].every(ch => s.guessed.includes(ch)) &&
    [1, 2].includes(s.current) && (s.players === '2' || s.current === 1) &&
    s.scores && typeof s.scores === 'object' && !Array.isArray(s.scores) &&
    s.scores[1] === 0 && s.scores[2] === 0);
}

export function createHangman(players = '1', random = Math.random) {
  if (!['1', '2'].includes(players)) throw new Error('Choose one or two Hangman players.');
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1)
    throw new Error('Hangman random source must return a value between zero and one.');
  return { players, word: HANGMAN_WORDS[Math.floor(value * HANGMAN_WORDS.length)],
    guessed: [], wrong: 0, current: 1, scores: { 1: 0, 2: 0 } };
}

export function guessHangman(s, letter) {
  if (!validHangmanState(s)) throw new Error('Hangman needs a valid unfinished round.');
  if (typeof letter !== 'string' || !/^[A-Z]$/.test(letter))
    throw new Error('Guess one letter from A to Z.');
  if (s.guessed.includes(letter)) throw new Error('That letter has already been guessed.');
  const occurrences = [...s.word].filter(ch => ch === letter).length;
  const guessed = [...s.guessed, letter];
  const wrong = s.wrong + (occurrences ? 0 : 1);
  const outcome = [...s.word].every(ch => guessed.includes(ch)) ? 'win' :
    wrong === MAX_MISSES ? 'loss' : null;
  const scores = { ...s.scores };
  if (outcome === 'win') scores[s.current]++;
  return {
    state: { players: s.players, word: s.word, guessed, wrong,
      current: !outcome && s.players === '2' ? 3 - s.current : s.current, scores },
    correct: occurrences > 0, occurrences, outcome,
  };
}
