// Word Scramble — unscramble the shuffled word before you run out of guesses.
// Pure DOM; listens to arcade:themechange.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
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

export default {
  async render(el, game, { navigate } = {}) {
    const shell = createShell(el, game, { title: 'Word Scramble', meta: 'Unscramble the word' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('ws-vibe');

    const saved = loadJSON(KEYS.SETTINGS + ':word-scramble', { rounds: '8' });
    const settings = await renderSetup(stage, {
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
    let solved = false;

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
    }

    function giveHint() {
      hintsUsed++;
      const feedback = card.querySelector('.ws-feedback');
      feedback.textContent = `Starts with "${word[0]}"`;
      window.arcadeAudio?.tap();
    }

    function checkGuess(value) {
      const audio = window.arcadeAudio;
      const feedback = card.querySelector('.ws-feedback');
      if (value.trim().toUpperCase() === word) {
        solved = true;
        correctCount++;
        if (audio) { audio.prepare(); audio.chime(); }
        window.haptics?.success();
        feedback.textContent = '✅ Correct!';
        card.querySelector('.ws-input').disabled = true;
        setTimeout(() => nextRound(), 900);
      } else {
        if (audio) { audio.prepare(); audio.buzz(); }
        window.haptics?.failure();
        feedback.textContent = '❌ Not quite — try again';
      }
    }

    function nextRound() {
      round++;
      solved = false;
      if (round <= totalRounds) pickWord();
      render();
    }

    function pickWord() {
      if (!pool.length) refillPool();
      word = pool.pop();
      letters = shuffle(word);
    }

    function newGame() {
      round = 1; correctCount = 0; hintsUsed = 0; solved = false;
      refillPool();
      pickWord();
      render();
    }

    getResetButton().addEventListener('click', newGame);

    const onTheme = () => render();
    window.addEventListener('arcade:themechange', onTheme);
    newGame();
    return { dispose: () => window.removeEventListener('arcade:themechange', onTheme) };
  },
};
