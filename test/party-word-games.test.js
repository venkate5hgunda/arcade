import test from 'node:test';
import assert from 'node:assert/strict';
import { deal, passChits, matches, stackPoints, validState as validStar } from '../games/show-star.js';
import { WORDS, evaluateGuess, validState as validWord } from '../games/wordle.js';
import { CARDS, secondsLeft, applyOutcome, validState as validTaboo } from '../games/taboo.js';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('Show Star deals exactly four of each symbol, and passing conserves chits for every player count', () => {
  for (let players = 3; players <= 8; players++) {
    let hands = deal(players, () => .37);
    for (let round = 0; round < 30; round++) {
      assert.equal(hands.length, players);
      assert.ok(hands.every(h => h.length === 4));
      for (let symbol = 0; symbol < players; symbol++) assert.equal(hands.flat().filter(c => c === symbol).length, 4);
      const picks = hands.map((_,i) => (i + round) % 4);
      const next = passChits(hands, picks);
      next.forEach((h,i) => assert.equal(h[3], hands[(i + players - 1) % players][picks[(i + players - 1) % players]]));
      hands = next;
    }
  }
});
const starState = () => ({ players:3,rounds:3,round:1,scores:[0,0,0],hands:[[0,0,0,0],[1,1,1,1],[2,2,2,2]],picks:[],phase:'passing',stack:[] });
test('Show Star matches four and awards descending points in arrival order', () => {
  assert.ok(matches([1,1,1,1])); assert.ok(!matches([1,1,1,2])); assert.ok(!matches([1,1,1]));
  assert.deepEqual(stackPoints([2,0,1],3),[2,1,3]);
  const s=starState();assert.ok(validStar(s));s.phase='slapping';s.stack=[0];assert.ok(validStar(s));
  s.stack=[0,2,1];s.phase='scored';assert.ok(validStar(s));
  s.stack=[0,0,1];assert.ok(!validStar(s));
});
test('Show Star rejects corrupt hands, selections, impossible initiators and scores', () => {
  for (const alter of [s=>s.hands[0][0]=1,s=>s.hands[0]=[],s=>s.picks=[5],s=>s.scores[1]=-1,s=>s.round=99,s=>{s.phase='slapping';s.stack=[1];}]) {
    const s=starState();alter(s);assert.ok(!validStar(s));
  }
  assert.ok(!validStar(null));assert.ok(!validStar({}));
});
test('Wordle reserves exact matches before allocating repeated letters', () => {
  assert.deepEqual(evaluateGuess('APPLE','APPLE'),Array(5).fill('correct'));
  assert.deepEqual(evaluateGuess('ALLEY','APPLE'),['correct','present','absent','present','absent']);
  assert.deepEqual(evaluateGuess('EERIE','SHEEP'),['present','present','absent','absent','absent']);
  assert.deepEqual(evaluateGuess('LEVEL','HELLO'),['present','correct','absent','absent','present']);
});
test('Wordle vocabulary and resumable guesses are bounded and valid', () => {
  assert.equal(new Set(WORDS).size,WORDS.length);assert.ok(WORDS.every(w=>/^[A-Z]{5}$/.test(w)));
  assert.ok(validWord({answer:'APPLE',guesses:['ALLEY']}));
  for (const s of [null,{}, {answer:'XXXXX',guesses:[]}, {answer:'APPLE',guesses:['APPLE']}, {answer:'APPLE',guesses:Array(6).fill('ALLEY')}]) assert.ok(!validWord(s));
});
const tabooState=()=>({duration:60,turns:4,turn:0,scores:[0,0],phase:'playing',deadline:10000,deck:CARDS.map((_,i)=>i),index:0});
test('Taboo applies scoring only during an active turn before the deadline',()=>{
  const s=tabooState();assert.ok(applyOutcome(s,1,9999));assert.deepEqual(s.scores,[1,0]);
  assert.ok(!applyOutcome(s,1,10000));assert.deepEqual(s.scores,[1,0]);
  s.turn=1;assert.ok(applyOutcome(s,-1,5000));assert.deepEqual(s.scores,[1,-1]);
  assert.ok(applyOutcome(s,0,5000));assert.ok(!applyOutcome(s,100,5000));
  s.phase='ready';assert.ok(!applyOutcome(s,1,5000));
  assert.equal(secondsLeft(10000,10001),0);assert.equal(secondsLeft(10000,9999),1);
});
test('Taboo validates deck identity, time and scores, including expired turns for restore',()=>{
  const s=tabooState();assert.ok(validTaboo(s));
  s.deck[0]=s.deck[1];assert.ok(!validTaboo(s));
  const t=tabooState();t.deadline=Infinity;assert.ok(!validTaboo(t));
  t.phase='ready';t.deadline=null;assert.ok(validTaboo(t));
  assert.equal(CARDS.length,50);assert.ok(CARDS.every(c=>c.length===6&&c.every(w=>typeof w==='string'&&w.length)));
});
test('all new game modules, icons and styles are precached and exist',async()=>{
  const source=await readFile(new URL('../sw.js',import.meta.url),'utf8');
  const context={self:{addEventListener(){}},URL};vm.createContext(context);
  vm.runInContext(source+';globalThis.assets=STATIC_ASSETS;',context);
  for (const path of ['./games/show-star.js','./games/taboo.js','./games/wordle.js','./css/party-word-games.css','./assets/icons/game-icons/hand.svg','./assets/icons/game-icons/talk.svg','./assets/icons/tabler/letter-case.svg']) {
    assert.ok(context.assets.includes(path),path);await readFile(new URL('../'+path,import.meta.url));
  }
});
