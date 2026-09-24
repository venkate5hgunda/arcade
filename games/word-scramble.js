// Word Scramble — unscramble the shuffled word before you run out of guesses.
// Pure DOM; listens to arcade:themechange.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { celebrate } from '../js/celebration.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';

const WORDS = [
  'ARCADE', 'PUZZLE', 'PLAYER', 'VICTORY', 'CHAMPION', 'STRATEGY', 'REFLEX',
  'JOYSTICK', 'CONTROLLER', 'PIXEL', 'LEVEL', 'BONUS', 'COMBO', 'RETRO',
  'GALAXY', 'ROCKET', 'DRAGON', 'CASTLE', 'TREASURE', 'ADVENTURE', 'MYSTERY',
  'RAINBOW', 'THUNDER', 'CRYSTAL', 'PHOENIX', 'WIZARD', 'KNIGHT', 'JUNGLE',
  'VOLCANO', 'GLACIER', 'METEOR', 'COMET', 'NEBULA', 'ORBIT', 'COSMIC',
];

function shuffle(word) {
  const letters = word.split('');
  do {
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
  } while (letters.join('') === word && letters.length > 1);
  return letters;
}

function validState(s) {
  return s && typeof s === 'object' && !Array.isArray(s) &&
    ['5', '8', '12'].includes(s.rounds) && Number.isInteger(s.round) &&
    s.round >= 1 && s.round <= Number(s.rounds) &&
    Number.isInteger(s.correctCount) && s.correctCount >= 0 && s.correctCount <= s.round &&
    Number.isInteger(s.hintsUsed) && s.hintsUsed >= 0 &&
    typeof s.hinted === 'boolean' && typeof s.solved === 'boolean' &&
    (!s.solved || s.correctCount > 0) &&
    WORDS.includes(s.word) && Array.isArray(s.pool) &&
    s.pool.every(w => WORDS.includes(w)) && new Set(s.pool).size === s.pool.length &&
    !s.pool.includes(s.word) &&
    Array.isArray(s.letters) && s.letters.length === s.word.length &&
    s.letters.every(l => typeof l === 'string' && /^[A-Z]$/.test(l)) &&
    s.letters.slice().sort().join('') === s.word.split('').sort().join('');
}

export default {
  async render(el, game, { navigate, session } = {}) {
    const shell = createShell(el, game, { title: 'Word Scramble', meta: 'Unscramble the word' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('ws-vibe');

    const saved = loadJSON(KEYS.SETTINGS + ':word-scramble', { rounds: '8' });
    const restored = validState(session?.state) ? session.state : null;
    const settings = restored ? { rounds: restored.rounds } : await renderSetup(stage, {
      title: '🔤 Word Scramble',
      subtitle: 'How many words per game?',
      themeClass: 'ws-theme',
      fields: [{
        key: 'rounds', label: 'Rounds',
        options: [5, 8, 12].map((n) => ({ value: String(n), label: `${n} Words` })),
        default: saved.rounds,
      }],
      startLabel: 'Start Unscrambling',
    });
    saveJSON(KEYS.SETTINGS + ':word-scramble', settings);
    const totalRounds = parseInt(settings.rounds, 10) || 8;
    shell.root.querySelector('.game-meta').textContent = `${totalRounds} words · type the answer`;

    let pool = [], word = '', letters = [];
    let round = 0, correctCount = 0, hintsUsed = 0;
    let solved = false, hinted = false, advanceTimer = null, disposed = false;
    function checkpoint() {
      session?.save({ rounds: settings.rounds, pool: pool.slice(), word, letters: letters.slice(),
        round, correctCount, hintsUsed, hinted, solved });
    }
    function scheduleAdvance() {
      clearTimeout(advanceTimer);
      advanceTimer = setTimeout(() => { if (!disposed) nextRound(); }, 900);
    }

    const status = document.createElement('div');
    status.className = 'ws-status';
    stage.appendChild(status);

    const card = document.createElement('div');
    card.className = 'ws-card';
    stage.appendChild(card);

    function refillPool() {
      pool = WORDS.slice();
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
    }

    function render() {
      status.textContent = `Round ${Math.min(round, totalRounds)}/${totalRounds} · Correct: ${correctCount}`;
      card.innerHTML = '';
      if (round > totalRounds) {
        card.innerHTML = `
          <div class="ws-gameover">
            <h3>🎉 All Done!</h3>
            <p>You solved ${correctCount} of ${totalRounds} words.</p>
            <button class="ws-btn" id="playAgain">Play Again</button>
          </div>`;
        card.querySelector('#playAgain').addEventListener('click', newGame);
        return;
      }
      card.innerHTML = `
        <p class="ws-hint">${letters.length} letters</p>
        <div class="ws-scramble">${letters.map((l) => `<span class="ws-tile">${l}</span>`).join('')}</div>
        <form class="ws-form" autocomplete="off">
          <input class="ws-input" id="wsGuessInput" name="wsGuess" type="text" placeholder="Type your answer…" autocapitalize="characters" ${solved ? 'disabled' : ''}>
          <button class="ws-btn" type="submit">Guess</button>
        </form>
        <div class="ws-actions">
          <button class="ws-btn ws-btn-secondary" id="hintBtn" ${solved ? 'disabled' : ''}>💡 Hint</button>
          <button class="ws-btn ws-btn-secondary" id="skipBtn" ${solved ? 'disabled' : ''}>⏭️ Skip</button>
        </div>
        <p class="ws-feedback"></p>`;
      const form = card.querySelector('.ws-form');
      const input = card.querySelector('.ws-input');
      input.focus();
      form.addEventListener('submit', (e) => { e.preventDefault(); checkGuess(input.value); });
      card.querySelector('#hintBtn').addEventListener('click', giveHint);
      card.querySelector('#skipBtn').addEventListener('click', () => nextRound());
      if (solved) card.querySelector('.ws-feedback').textContent = '✅ Correct!';
      else if (hinted) card.querySelector('.ws-feedback').textContent = `Starts with "${word[0]}"`;
    }

    function giveHint() {
      if (solved) return;
      hintsUsed++;
      hinted = true;
      checkpoint();
      const feedback = card.querySelector('.ws-feedback');
      feedback.textContent = `Starts with "${word[0]}"`;
      window.arcadeAudio?.tap();
    }

    function checkGuess(value) {
      if (solved || disposed) return;
      const audio = window.arcadeAudio;
      const feedback = card.querySelector('.ws-feedback');
      if (value.trim().toUpperCase() === word) {
        solved = true;
        correctCount++;
        checkpoint();
        if (audio) { audio.prepare(); audio.chime(); }
        window.haptics?.success();
        feedback.textContent = '✅ Correct!';
        card.querySelector('.ws-input').disabled = true;
        scheduleAdvance();
      } else {
        if (audio) { audio.prepare(); audio.buzz(); }
        window.haptics?.failure();
        feedback.textContent = '❌ Not quite — try again';
      }
    }

    function nextRound() {
      clearTimeout(advanceTimer);
      round++;
      solved = false; hinted = false;
      if (round <= totalRounds) pickWord();
      if (round > totalRounds) {
        session?.finish();
        if (correctCount === totalRounds) celebrate(shell.root, 'Perfect word scramble!');
      }
      else checkpoint();
      render();
    }

    function pickWord() {
      if (!pool.length) refillPool();
      word = pool.pop();
      letters = shuffle(word);
    }

    function newGame() {
      shell.root.querySelector('.arcade-victory')?.remove();
      clearTimeout(advanceTimer);
      round = 1; correctCount = 0; hintsUsed = 0; solved = false; hinted = false;
      refillPool();
      pickWord();
      checkpoint();
      render();
    }

    getResetButton().addEventListener('click', newGame);

    const onTheme = () => render();
    window.addEventListener('arcade:themechange', onTheme);
    if (restored) {
      pool = restored.pool.slice(); word = restored.word; letters = restored.letters.slice();
      round = restored.round; correctCount = restored.correctCount; hintsUsed = restored.hintsUsed;
      solved = restored.solved; hinted = restored.hinted;
      render();
      if (solved) scheduleAdvance();
    } else newGame();
    return { dispose: () => {
      disposed = true;
      clearTimeout(advanceTimer);
      window.removeEventListener('arcade:themechange', onTheme);
    } };
  },
};
