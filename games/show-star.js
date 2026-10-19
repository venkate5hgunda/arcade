import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { playerName } from '../js/player-names.js';
import { celebrate } from '../js/celebration.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';

export const SYMBOLS = ['★ Star', '☀ Sun', '☾ Moon', '♣ Clover', '◆ Diamond', '♥ Heart', '✿ Flower', '⚡ Bolt'];
export function deal(players, random = Math.random) {
  const deck = Array.from({ length: players * 4 }, (_, i) => Math.floor(i / 4));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return Array.from({ length: players }, (_, i) => deck.slice(i * 4, i * 4 + 4));
}
export const matches = hand => hand.length === 4 && hand.every(chit => chit === hand[0]);
export function passChits(hands, picks) {
  return hands.map((hand, i) => [...hand.filter((_, j) => j !== picks[i]), hands[(i + hands.length - 1) % hands.length][picks[(i + hands.length - 1) % hands.length]]]);
}
export const stackPoints = (stack, players) => Array.from({ length: players }, (_, i) => stack.includes(i) ? players - stack.indexOf(i) : 0);
export function validState(s) {
  if (!s || !Number.isInteger(s.players) || s.players < 3 || s.players > 8 ||
      ![3, 5, 10].includes(s.rounds) || !Number.isInteger(s.round) || s.round < 1 || s.round > s.rounds ||
      !Array.isArray(s.scores) || s.scores.length !== s.players || !s.scores.every(n => Number.isInteger(n) && n >= 0 && n <= s.players * s.rounds) ||
      !Array.isArray(s.hands) || s.hands.length !== s.players || !s.hands.every(h => Array.isArray(h) && h.length === 4 && h.every(c => Number.isInteger(c) && c >= 0 && c < s.players)) ||
      !Array.isArray(s.picks) || s.picks.length >= s.players || !s.picks.every(n => Number.isInteger(n) && n >= 0 && n < 4) ||
      !['passing', 'slapping', 'scored'].includes(s.phase) || !Array.isArray(s.stack) || new Set(s.stack).size !== s.stack.length || !s.stack.every(n => Number.isInteger(n) && n >= 0 && n < s.players)) return false;
  if (!Array.from({ length: s.players }, (_, i) => s.hands.flat().filter(c => c === i).length === 4).every(Boolean)) return false;
  return s.phase === 'passing' ? s.stack.length === 0 : s.stack.length > 0 && s.stack[0] === s.picks.length && matches(s.hands[s.stack[0]]) && (s.phase === 'scored' ? s.stack.length === s.players : s.stack.length < s.players);
}

export default {
  async render(el, game, { navigate, session } = {}) {
    const shell = createShell(el, game, { meta: 'Match four. Palm down. Race for the stack.' });
    if (navigate) wireBack(shell, navigate);
    const { stage } = shell;
    stage.classList.add('new-game');
    const restored = validState(session?.state) ? structuredClone(session.state) : null;
    const saved = loadJSON(KEYS.SETTINGS + ':show-star', {});
    const settings = restored || await renderSetup(stage, {
      title: 'Show Star', subtitle: 'One shared device · private chits, then a SLAP race. Put the screen flat where everyone can reach.',
      fields: [{ key: 'players', label: 'Players', options: [3,4,5,6,7,8].map(n => ({ value: String(n), label: String(n) })), default: String(saved.players || 4) },
        { key: 'rounds', label: 'Rounds', options: [3,5,10].map(n => ({ value: String(n), label: String(n) })), default: String(saved.rounds || 3) }],
      startLabel: 'Deal chits',
    });
    const players = Number(settings.players), rounds = Number(settings.rounds);
    saveJSON(KEYS.SETTINGS + ':show-star', { players, rounds });
    const fresh = (scores = Array(players).fill(0), round = 1) => ({ players, rounds, round, scores, hands: deal(players), picks: [], phase: 'passing', stack: [] });
    let s = restored || fresh(), revealed = false, announced = false;
    const save = () => s.phase === 'scored' && s.round === rounds ? session?.finish() : session?.save(s);
    function button(text, action, className = '') {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'game-ui-action ' + className; b.textContent = text; b.addEventListener('click', action); return b;
    }
    function draw() {
      stage.replaceChildren();
      const title = document.createElement('h2'); title.textContent = `Round ${s.round} of ${rounds}`;
      const scores = document.createElement('p'); scores.textContent = s.scores.map((n,i) => `${playerName(i)}: ${n}`).join(' · ');
      const status = document.createElement('p'); status.setAttribute('role', 'status');
      stage.append(title, scores, status);
      if (s.phase === 'passing') {
        const seat = s.picks.length;
        status.textContent = revealed ? `${playerName(seat)}: choose one chit to pass clockwise, or SLAP with four matching.` : `Pass to ${playerName(seat)}. Everyone else, look away.`;
        if (!revealed) stage.append(button('Reveal my four chits', () => { revealed = true; draw(); }));
        else {
          const hand = document.createElement('div'); hand.className = 'chit-hand';
          s.hands[seat].forEach((c,i) => hand.append(button(SYMBOLS[c], () => {
            s.picks.push(i);
            if (s.picks.length === players) { s.hands = passChits(s.hands, s.picks); s.picks = []; }
            revealed = false; save(); draw();
          }, 'chit')));
          stage.append(hand);
          if (matches(s.hands[seat])) stage.append(button('SLAP! I have four matching', () => {
            s.phase = 'slapping'; s.stack = [seat]; revealed = false; save(); window.arcadeAudio?.chime(); draw();
          }, 'slap-start'));
        }
        const note = document.createElement('p'); note.textContent = 'Each player secretly chooses one chit. All chosen chits move one seat clockwise together after the last choice. Hands stay hidden between players.'; stage.append(note);
      } else {
        status.textContent = s.phase === 'slapping' ? 'Palm down — lighter side toward the floor! Everyone: tap your own SLAP pad. First tap is the lowest hand.' : 'Stack complete — lowest hand earns the most points.';
        const pads = document.createElement('div'); pads.className = 'slap-pads';
        for (let i = 0; i < players; i++) {
          const rank = s.stack.indexOf(i);
          const b = button(rank < 0 ? `${playerName(i)} — SLAP!` : `${playerName(i)} · #${rank + 1} · +${players - rank}`, () => {
            if (s.phase !== 'slapping' || s.stack.includes(i)) return;
            s.stack.push(i); window.haptics?.select();
            if (s.stack.length === players) { const points = stackPoints(s.stack, players); s.scores = s.scores.map((n,j) => n + points[j]); s.phase = 'scored'; }
            save(); draw();
          }, 'slap-pad'); b.disabled = rank >= 0;
          b.addEventListener('pointerdown', event => { if (event.button !== 0 || b.disabled) return; event.preventDefault(); b.click(); });
          pads.append(b);
        }
        stage.append(pads);
        if (s.phase === 'scored') {
          if (s.round === rounds) {
            const winners = s.scores.map((n,i) => n === Math.max(...s.scores) ? playerName(i) : null).filter(Boolean);
            const result = document.createElement('h3'); result.textContent = `${winners.join(' & ')} win${winners.length === 1 ? 's' : ''}!`; stage.append(result);
            if (!announced) { announced = true; celebrate(shell.root, result.textContent); }
          }
          stage.append(button(s.round === rounds ? 'New match' : 'Next round', () => { s = s.round === rounds ? fresh() : fresh(s.scores, s.round + 1); announced = false; save(); draw(); }));
        }
      }
    }
    shell.getResetButton().addEventListener('click', () => { s = fresh(); revealed = false; announced = false; save(); draw(); });
    save(); draw();
    return { dispose() { revealed = false; stage.replaceChildren(); } };
  },
};
