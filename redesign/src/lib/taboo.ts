import { shuffle } from './puzzles.ts';
export const CARDS: string[][] = [
  ['Bicycle', 'wheels', 'pedal', 'ride', 'bike', 'handlebars'],
  ['Pizza', 'cheese', 'slice', 'crust', 'tomato', 'delivery'],
  ['Library', 'books', 'read', 'quiet', 'borrow', 'shelves'],
  ['Elephant', 'trunk', 'tusks', 'animal', 'large', 'gray'],
  ['Rainbow', 'colors', 'rain', 'sky', 'sun', 'arc'],
  ['Popcorn', 'movie', 'corn', 'butter', 'snack', 'pop'],
  ['Airport', 'plane', 'fly', 'travel', 'luggage', 'terminal'],
  ['Birthday', 'cake', 'candles', 'party', 'age', 'presents'],
  ['Guitar', 'strings', 'music', 'play', 'instrument', 'strum'],
  ['Snowman', 'winter', 'snow', 'carrot', 'cold', 'build'],
  ['Ocean', 'water', 'sea', 'waves', 'beach', 'salt'],
  ['Doctor', 'hospital', 'patient', 'sick', 'medicine', 'health'],
  ['Mountain', 'climb', 'peak', 'high', 'hill', 'summit'],
  ['Chocolate', 'sweet', 'cocoa', 'brown', 'candy', 'bar'],
  ['Camera', 'photo', 'picture', 'lens', 'shoot', 'film'],
  ['Umbrella', 'rain', 'wet', 'open', 'cover', 'weather'],
  ['Robot', 'machine', 'metal', 'computer', 'automatic', 'human'],
  ['Chess', 'king', 'queen', 'board', 'checkmate', 'pawn'],
  ['Volcano', 'lava', 'erupt', 'mountain', 'hot', 'ash'],
  ['Dentist', 'teeth', 'mouth', 'drill', 'cavity', 'brush'],
  ['Passport', 'travel', 'country', 'identity', 'border', 'document'],
  ['Pillow', 'sleep', 'bed', 'head', 'soft', 'cushion'],
  ['Penguin', 'bird', 'ice', 'black', 'white', 'waddle'],
  ['Telescope', 'stars', 'space', 'look', 'lens', 'planets'],
  ['Sandwich', 'bread', 'filling', 'lunch', 'toast', 'slices'],
  ['Firefighter', 'fire', 'truck', 'hose', 'rescue', 'flames'],
  ['Calendar', 'date', 'month', 'year', 'days', 'schedule'],
  ['Mirror', 'reflection', 'glass', 'look', 'face', 'image'],
  ['Treasure', 'gold', 'pirate', 'chest', 'map', 'buried'],
  ['Waterfall', 'river', 'drop', 'water', 'cliff', 'cascade'],
  ['Astronaut', 'space', 'rocket', 'moon', 'suit', 'planet'],
  ['Kangaroo', 'jump', 'pouch', 'Australia', 'animal', 'hop'],
  ['Keyboard', 'type', 'keys', 'computer', 'letters', 'piano'],
  ['Lighthouse', 'ship', 'sea', 'light', 'coast', 'tower'],
  ['Honey', 'bees', 'sweet', 'hive', 'sticky', 'nectar'],
  ['Camping', 'tent', 'outside', 'fire', 'sleep', 'woods'],
  ['Detective', 'clues', 'crime', 'solve', 'mystery', 'investigate'],
  ['Clock', 'time', 'hands', 'hour', 'minute', 'tick'],
  ['Dragon', 'fire', 'wings', 'scales', 'myth', 'fly'],
  ['Train', 'tracks', 'rail', 'station', 'engine', 'carriage'],
  ['Garden', 'plants', 'flowers', 'grow', 'soil', 'water'],
  ['Ice cream', 'cold', 'cone', 'scoop', 'frozen', 'dessert'],
  ['Bridge', 'cross', 'river', 'road', 'connect', 'span'],
  ['Magnet', 'metal', 'attract', 'iron', 'poles', 'stick'],
  ['Newspaper', 'news', 'read', 'print', 'headlines', 'journalist'],
  ['Spider', 'web', 'legs', 'eight', 'insect', 'crawl'],
  ['Suitcase', 'travel', 'pack', 'luggage', 'clothes', 'bag'],
  ['Chef', 'cook', 'kitchen', 'food', 'restaurant', 'recipe'],
  ['Kite', 'wind', 'fly', 'string', 'sky', 'paper'],
  ['Basketball', 'hoop', 'ball', 'court', 'bounce', 'shoot'],
];
export interface TabooState {
  turns: number;
  turn: number;
  duration: number;
  phase: 'ready' | 'playing';
  scores: number[];
  index: number;
  deck: number[];
  deadline: number | null;
}
export const secondsLeft = (deadline: number, now = Date.now()) =>
  Math.max(0, Math.ceil((deadline - now) / 1000));
export function validTaboo(
  value: unknown,
  now = Date.now(),
): value is TabooState {
  const s = value as TabooState;
  return (
    !!s &&
    [4, 6, 8].includes(s.turns) &&
    Number.isInteger(s.turn) &&
    s.turn >= 0 &&
    s.turn < s.turns &&
    [30, 60, 90].includes(s.duration) &&
    ['ready', 'playing'].includes(s.phase) &&
    Array.isArray(s.scores) &&
    s.scores.length === 2 &&
    s.scores.every((n) => Number.isInteger(n) && Math.abs(n) <= 100000) &&
    Number.isInteger(s.index) &&
    s.index >= 0 &&
    s.index < CARDS.length &&
    Array.isArray(s.deck) &&
    s.deck.length === CARDS.length &&
    new Set(s.deck).size === CARDS.length &&
    s.deck.every((n) => Number.isInteger(n) && n >= 0 && n < CARDS.length) &&
    (s.phase === 'ready'
      ? s.deadline === null
      : Number.isFinite(s.deadline) &&
        s.deadline! > 0 &&
        s.deadline! <= now + s.duration * 1000)
  );
}
export function newTaboo(duration: number, turns: number): TabooState {
  if (![30, 60, 90].includes(duration) || ![4, 6, 8].includes(turns))
    throw new RangeError('Choose a valid turn length and number of turns.');
  return {
    duration,
    turns,
    turn: 0,
    scores: [0, 0],
    phase: 'ready',
    deadline: null,
    deck: shuffle(CARDS.map((_, i) => i)),
    index: 0,
  };
}
export function advanceCard(s: TabooState): TabooState {
  let index = s.index + 1,
    deck = s.deck;
  if (index === CARDS.length) {
    index = 0;
    deck = shuffle(CARDS.map((_, i) => i));
  }
  return { ...s, index, deck };
}
export function scoreTaboo(
  s: TabooState,
  points: number,
  now = Date.now(),
): TabooState | null {
  if (
    s.phase !== 'playing' ||
    s.deadline === null ||
    secondsLeft(s.deadline, now) === 0 ||
    ![-1, 0, 1].includes(points)
  )
    return null;
  const scores = s.scores.slice();
  scores[s.turn % 2] += points;
  return advanceCard({ ...s, scores });
}
export function finishTurn(s: TabooState): TabooState {
  return {
    ...advanceCard(s),
    turn: s.turn + 1,
    phase: 'ready',
    deadline: null,
  };
}
