// Memory Match — flip cards, find pairs. 1-2 players.
// Pure DOM; listens to arcade:themechange to repaint accents.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { playerName } from '../js/player-names.js';
import { celebrate } from '../js/celebration.js';
import { nextPlayer } from '../js/game-utils.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';

const SYMBOLS = ['🍎','🍌','🍇','🍓','🥝','🍋','🥭','🍒','🥥','🍍','🥑','🥕','🌽','🥔','🍅','🥦','🧄','🧅','🥜','🌰','🍞','🥐','🥖','🥨','🧀','🥚','🍳','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🍿','🧈','🧂','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍼','🥛','☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🧊','🥄','🍴','🍽️','🥣'];

function validState(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s) ||
      !['4', '6', '8'].includes(s.size) || !['1', '2'].includes(s.players) ||
      !Array.isArray(s.cards) || s.cards.length !== Number(s.size) ** 2 ||
      ![1, 2].includes(s.current) || (s.players === '1' && s.current !== 1) ||
      !s.scores || typeof s.scores !== 'object' || Array.isArray(s.scores) ||
      ![1, 2].every(p => Number.isSafeInteger(s.scores[p]) && s.scores[p] >= 0) ||
      (s.players === '1' && s.scores[2] !== 0) ||
      (s.firstPick !== null && (!Number.isInteger(s.firstPick) || s.firstPick < 0 || s.firstPick >= s.cards.length))) return false;
  const counts = new Map();
  for (let i = 0; i < s.cards.length; i++) {
    const c = s.cards[i];
    if (!c || c.index !== i || !SYMBOLS.slice(0, s.cards.length / 2).includes(c.symbol) ||
        typeof c.revealed !== 'boolean' || typeof c.matched !== 'boolean' ||
        (c.matched && !c.revealed) || (c.revealed && !c.matched && i !== s.firstPick)) return false;
    counts.set(c.symbol, (counts.get(c.symbol) || 0) + 1);
  }
  return counts.size === s.cards.length / 2 && [...counts.values()].every(n => n === 2) &&
    s.cards.every(c => s.cards.filter(other => other.symbol === c.symbol).every(other => other.matched === c.matched)) &&
    (s.firstPick === null || (s.cards[s.firstPick].revealed && !s.cards[s.firstPick].matched)) &&
    s.cards.filter(c => c.matched).length === 2 * (s.scores[1] + s.scores[2]) &&
    s.scores[1] + s.scores[2] < s.cards.length / 2;
}

export default {
  async render(el, game, { navigate, session } = {}) {
    const shell = createShell(el, game, { title: 'Memory Match', meta: 'Flip cards, find pairs' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('mem-vibe');

    const saved = loadJSON(KEYS.SETTINGS + ':memory', { size: '4', players: '1' });
    const restored = validState(session?.state) ? session.state : null;
    const settings = restored ? { size: restored.size, players: restored.players } : await renderSetup(stage, {
      title: '🧠 Memory Match',
      subtitle: 'Choose your grid and players',
      themeClass: 'mem-theme',
      fields: [
        {
          key: 'size', label: 'Grid size',
          options: [
            { value: '4', label: '4×4 · Easy' },
            { value: '6', label: '6×6 · Medium' },
            { value: '8', label: '8×8 · Hard' },
          ],
          default: saved.size,
        },
        {
          key: 'players', label: 'Players',
          options: [
            { value: '1', label: 'Solo' },
            { value: '2', label: '2 Players' },
          ],
          default: saved.players,
        },
      ],
      startLabel: 'Start Matching',
    });
    saveJSON(KEYS.SETTINGS + ':memory', settings);

    let size = Math.max(2, Math.min(8, parseInt(settings.size, 10) || 4));
    const total0 = size * size;
    if (total0 % 2 !== 0) size++;
    const total = size * size;
    const playerCount = settings.players === '2' ? 2 : 1;
    shell.root.querySelector('.game-meta').textContent = `${size}×${size} grid · ${total / 2} pairs · ${playerCount === 2 ? '2 players' : 'solo'}`;

    let cards = [], firstPick = null, lock = false, gameOver = false, recentFlip = -1;
    let current = 1, scores = { 1: 0, 2: 0 };
    let disposed = false, mismatchTimer = null, roundId = 0;

    function checkpoint() {
      session?.save({ size: settings.size, players: settings.players, cards: cards.map(c => ({ ...c })),
        firstPick, current, scores: { ...scores } });
    }

    const grid = document.createElement('div');
    grid.className = 'mem-grid';
    grid.style.gridTemplateColumns = `repeat(${size}, minmax(0, 1fr))`;
    stage.appendChild(grid);

    const status = document.createElement('div');
    status.className = 'mem-status';
    stage.insertBefore(status, grid);

    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }

    function newGame() {
      roundId++;
      shell.root.querySelector('.arcade-victory')?.remove();
      clearTimeout(mismatchTimer);
      const pairs = total / 2;
      const deck = SYMBOLS.slice(0, pairs).flatMap(s => [s, s]);
      shuffle(deck);
      cards = deck.map((symbol, i) => ({ symbol, revealed: false, matched: false, index: i }));
      firstPick = null; lock = false; gameOver = false;
      recentFlip = -1;
      current = 1; scores = { 1: 0, 2: 0 };
      checkpoint();
      render();
    }

    function render() {
      grid.innerHTML = '';
      for (const card of cards) {
        const btn = document.createElement('button');
        btn.className = 'mem-card';
        btn.setAttribute('aria-label', `${card.revealed || card.matched ? 'Revealed' : 'Flip'} card ${card.index + 1}`);
        if (card.revealed || card.matched) {
          btn.classList.add('revealed');
          if (card.index === recentFlip) btn.classList.add('just-flipped');
          btn.textContent = card.symbol;
        } else {
          btn.textContent = '❓';
        }
        if (card.matched) btn.classList.add('matched');
        btn.disabled = card.revealed || card.matched || lock;
        btn.addEventListener('click', () => onFlip(card.index));
        grid.appendChild(btn);
      }
      updateStatus();
      recentFlip = -1;
    }

    function updateStatus() {
      if (gameOver) return;
      const p = playerCount === 1 ? '' : ` · P${current}'s turn`;
      status.textContent = `Pairs found: ${scores[1] + scores[2]} / ${cards.length / 2}${p}`;
    }

    async function onFlip(i) {
      if (disposed || gameOver || lock || cards[i].revealed || cards[i].matched) return;
      lock = true;
      const startedRound = roundId;
      const audio = window.arcadeAudio;
      if (audio) await audio.prepare();
      if (disposed || gameOver || startedRound !== roundId) return;
      cards[i].revealed = true;
      recentFlip = i;
      if (audio) audio.tap();

      if (firstPick === null) {
        firstPick = i;
        lock = false;
        checkpoint();
        render();
        return;
      }

      render();
      const match = cards[firstPick].symbol === cards[i].symbol;
      if (match) {
        cards[firstPick].matched = cards[i].matched = true;
        scores[current]++;
        if (audio) audio.chime();
        if (window.haptics) window.haptics.success();
        if (cards.every(c => c.matched)) {
          gameOver = true;
          session?.finish();
          if (playerCount === 1) {
            status.textContent = `🎉 All pairs found! Mismatches: ${cards.length / 2 - scores[1]}`;
            celebrate(shell.root, 'You found every pair!');
          } else {
            const winner = scores[1] > scores[2] ? 1 : (scores[2] > scores[1] ? 2 : 0);
            status.textContent = winner ? `🎉 ${playerName(winner - 1)} wins!` : "🤝 It's a tie!";
            if (winner) celebrate(shell.root, `${playerName(winner - 1)} wins Memory!`);
          }
        }
      } else {
        if (audio) audio.buzz();
        if (window.haptics) window.haptics.failure();
        await new Promise(r => { mismatchTimer = setTimeout(r, 700); });
        if (disposed || gameOver || startedRound !== roundId) return;
        cards[firstPick].revealed = cards[i].revealed = false;
        if (playerCount === 2) current = nextPlayer(current, 2);
      }
      firstPick = null;
      lock = false;
      if (!gameOver) checkpoint();
      render();
    }

    getResetButton().addEventListener('click', newGame);

    const onTheme = () => render();
    window.addEventListener('arcade:themechange', onTheme);
    if (restored) {
      cards = restored.cards.map(c => ({ ...c }));
      firstPick = restored.firstPick; current = restored.current; scores = { ...restored.scores };
      render();
    } else newGame();
    return { dispose: () => {
      disposed = true;
      clearTimeout(mismatchTimer);
      window.removeEventListener('arcade:themechange', onTheme);
    } };
  },
};
