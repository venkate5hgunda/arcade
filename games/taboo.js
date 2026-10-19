import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { celebrate } from '../js/celebration.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';

// Original clue cards; the group judges spoken clues.
export const CARDS = [
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
export const secondsLeft = (deadline, now = Date.now()) => Math.max(0, Math.ceil((deadline - now) / 1000));
export function validState(s) {
  return !!s && [4,6,8].includes(s.turns) && Number.isInteger(s.turn) && s.turn >= 0 && s.turn < s.turns &&
    [30,60,90].includes(s.duration) && ['ready','playing'].includes(s.phase) &&
    Array.isArray(s.scores) && s.scores.length === 2 && s.scores.every(n => Number.isInteger(n) && Math.abs(n) <= 100000) &&
    Number.isInteger(s.index) && s.index >= 0 && s.index < CARDS.length &&
    Array.isArray(s.deck) && s.deck.length === CARDS.length && new Set(s.deck).size === CARDS.length && s.deck.every(n => Number.isInteger(n) && n >= 0 && n < CARDS.length) &&
    (s.phase === 'ready' ? s.deadline === null : Number.isFinite(s.deadline) && s.deadline > 0 && s.deadline <= Date.now() + s.duration * 1000);
}
// Deadline checks live with scoring so a late click cannot earn a point.
export function applyOutcome(state, points, now = Date.now()) {
  if (state.phase !== 'playing' || secondsLeft(state.deadline, now) === 0 || ![-1,0,1].includes(points)) return false;
  state.scores[state.turn % 2] += points;
  return true;
}
function shuffledDeck() {
  const deck = CARDS.map((_,i) => i);
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i],deck[j]] = [deck[j],deck[i]]; }
  return deck;
}
export default {
  async render(el, game, { navigate, session } = {}) {
    const shell = createShell(el, game, { meta: 'Two teams · forbidden words · fast clues' });
    if (navigate) wireBack(shell, navigate);
    const { stage } = shell; stage.classList.add('new-game');
    const restored = validState(session?.state) ? structuredClone(session.state) : null;
    const saved = loadJSON(KEYS.SETTINGS + ':taboo', {});
    const settings = restored || await renderSetup(stage, {
      title: 'Taboo', subtitle: 'Split into two teams. Only the clue giver and an opposing referee should see the card. No target, forbidden words, word parts, rhymes or gestures.',
      fields: [{ key: 'duration', label: 'Seconds per turn', options: [30,60,90].map(n => ({value:String(n),label:String(n)})), default:String(saved.duration || 60) },
        { key:'turns',label:'Total turns',options:[4,6,8].map(n=>({value:String(n),label:String(n)})),default:String(saved.turns || 4) }], startLabel:'Gather teams',
    });
    const duration = Number(settings.duration), turns = Number(settings.turns);
    saveJSON(KEYS.SETTINGS + ':taboo', { duration, turns });
    const fresh = () => ({ duration, turns, turn:0, scores:[0,0], phase:'ready', deadline:null, deck:shuffledDeck(), index:0 });
    let s = restored || fresh(), visible = false, finished = false;
    function button(text, action) { const b = document.createElement('button'); b.type='button'; b.className='game-ui-action'; b.textContent=text; b.addEventListener('click',action); return b; }
    function nextCard() { s.index++; if (s.index === CARDS.length) { s.index = 0; s.deck = shuffledDeck(); } }
    function expire() {
      if (s.phase !== 'playing' || secondsLeft(s.deadline) > 0) return false;
      nextCard(); s.turn++; s.phase='ready'; s.deadline=null; visible=false;
      if (s.turn === turns) { finished=true; session?.finish(); }
      else session?.save(s);
      window.arcadeAudio?.chime(); draw(); return true;
    }
    function draw() {
      stage.replaceChildren();
      const title=document.createElement('h2'); title.textContent=finished ? 'Final scores' : `Team ${s.turn % 2 + 1} · turn ${s.turn + 1} of ${turns}`;
      const scores=document.createElement('p'); scores.textContent=`Team 1: ${s.scores[0]} · Team 2: ${s.scores[1]}`;
      const status=document.createElement('p'); status.setAttribute('role','status');
      stage.append(title,scores,status);
      if (finished) {
        status.textContent=s.scores[0] === s.scores[1] ? 'It’s a tie!' : `Team ${s.scores[0] > s.scores[1] ? 1 : 2} wins!`;
        stage.append(button('New match',reset)); celebrate(shell.root,status.textContent); return;
      }
      if (!visible) {
        status.textContent=s.phase==='playing' ? 'Turn in progress — the timer keeps running. Return to the clue giver.' : 'Pass to the next clue giver. Guessers, look away. An opposing player checks forbidden words.';
        stage.append(button(s.phase==='playing' ? 'Reveal card and continue' : 'Start timed turn',()=>{
          if (expire()) return;
          if (s.phase==='ready') { s.phase='playing'; s.deadline=Date.now()+duration*1000; }
          visible=true; session?.save(s); draw();
        }));
      } else {
        const clock=document.createElement('p'); clock.className='taboo-clock'; clock.textContent=`${secondsLeft(s.deadline)} seconds left`; stage.append(clock);
        const card=document.createElement('div'); card.className='taboo-card game-ui-panel';
        const [target,...forbidden]=CARDS[s.deck[s.index]];
        const word=document.createElement('h3'); word.textContent=target;
        const label=document.createElement('p'); label.textContent='Do not say:';
        const list=document.createElement('ul'); forbidden.forEach(w=>{const li=document.createElement('li');li.textContent=w;list.append(li);}); card.append(word,label,list);stage.append(card);
        const actions=document.createElement('div');actions.className='new-game-actions';
        for (const [label,points] of [['Correct +1',1],['Skip · 0',0],['Forbidden word −1',-1]]) actions.append(button(label,()=>{
          if (expire()) return;
          if (!applyOutcome(s, points)) { expire(); return; }
          nextCard();session?.save(s);draw();
        }));
        stage.append(actions,button('Hide card',()=>{visible=false;draw();}));
        status.textContent='The group judges clues. Correct +1 · Skip 0 · Forbidden word −1.';
      }
    }
    function reset(){s=fresh();visible=false;finished=false;shell.root.querySelector('.arcade-victory')?.remove();session?.save(s);draw();}
    shell.getResetButton().addEventListener('click',reset);
    if (!expire()) { session?.save(s);draw(); }
    const timer=setInterval(()=>{
      if (finished || s.phase!=='playing' || expire()) return;
      const clock=stage.querySelector('.taboo-clock');if(clock)clock.textContent=`${secondsLeft(s.deadline)} seconds left`;
    },250);
    return {dispose(){clearInterval(timer);visible=false;stage.replaceChildren();}};
  },
};
