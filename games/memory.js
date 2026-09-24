// Memory Match — flip cards, find pairs. 1-2 players.
// Pure DOM; listens to arcade:themechange to repaint accents.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { nextPlayer } from '../js/game-utils.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';

const SYMBOLS = ['🍎','🍌','🍇','🍓','🥝','🍋','🥭','🍒','🥥','🍍','🥑','🥕','🌽','🥔','🍅','🥦','🧄','🧅','🥜','🌰','🍞','🥐','🥖','🥨','🧀','🥚','🍳','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🍿','🧈','🧂','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍼','🥛','☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🧊','🥄','🍴','🍽️','🥣'];

export default {
  async render(el, game, { navigate } = {}) {
    const shell = createShell(el, game, { title: 'Memory Match', meta: 'Flip cards, find pairs' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('mem-vibe');

    const saved = loadJSON(KEYS.SETTINGS + ':memory', { size: '4', players: '1' });
    const settings = await renderSetup(stage, {
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

    let cards = [], firstPick = null, lock = false, gameOver = false;
    let current = 1, scores = { 1: 0, 2: 0 };

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
      const pairs = total / 2;
      const deck = SYMBOLS.slice(0, pairs).flatMap(s => [s, s]);
      shuffle(deck);
      cards = deck.map((symbol, i) => ({ symbol, revealed: false, matched: false, index: i }));
      firstPick = null; lock = false; gameOver = false;
      current = 1; scores = { 1: 0, 2: 0 };
      render();
    }

    function render() {
      grid.innerHTML = '';
      for (const card of cards) {
        const btn = document.createElement('button');
        btn.className = 'mem-card';
        btn.setAttribute('aria-label', `Card ${card.index + 1}`);
        if (card.revealed || card.matched) {
          btn.classList.add('revealed');
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
    }

    function updateStatus() {
      if (gameOver) return;
      const p = playerCount === 1 ? '' : ` · P${current}'s turn`;
      status.textContent = `Pairs found: ${scores[1] + scores[2]} / ${cards.length / 2}${p}`;
    }

    async function onFlip(i) {
      if (lock || cards[i].revealed || cards[i].matched) return;
      const audio = window.arcadeAudio;
      if (audio) await audio.prepare();
      cards[i].revealed = true;
      if (audio) audio.tap();
      render();

      if (firstPick === null) {
        firstPick = i;
        return;
      }

      lock = true;
      const match = cards[firstPick].symbol === cards[i].symbol;
      if (match) {
        cards[firstPick].matched = cards[i].matched = true;
        scores[current]++;
        if (audio) audio.chime();
        if (window.haptics) window.haptics.success();
        if (cards.every(c => c.matched)) {
          gameOver = true;
          if (playerCount === 1) {
            status.textContent = `🎉 All pairs found! Mismatches: ${cards.length / 2 - scores[1]}`;
          } else {
            const winner = scores[1] > scores[2] ? 1 : (scores[2] > scores[1] ? 2 : 0);
            status.textContent = winner ? `🎉 Player ${winner} wins!` : "🤝 It's a tie!";
          }
        }
      } else {
        if (audio) audio.buzz();
        if (window.haptics) window.haptics.failure();
        await new Promise(r => setTimeout(r, 700));
        cards[firstPick].revealed = cards[i].revealed = false;
        if (playerCount === 2) current = nextPlayer(current, 2);
      }
      firstPick = null;
      lock = false;
      render();
    }

    getResetButton().addEventListener('click', newGame);

    const onTheme = () => render();
    window.addEventListener('arcade:themechange', onTheme);
    newGame();
    return { dispose: () => window.removeEventListener('arcade:themechange', onTheme) };
  },
};
