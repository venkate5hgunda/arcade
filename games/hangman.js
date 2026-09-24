// Hangman — guess the word. 1-2 players.
// Pure DOM; listens to arcade:themechange to repaint accents.

import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { playerName } from '../js/player-names.js';
import { celebrate } from '../js/celebration.js';
import { nextPlayer } from '../js/game-utils.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';

const WORDS = [
  'ARCADE', 'PUZZLE', 'GAME', 'PLAYER', 'WINNER', 'CHAMPION', 'VICTORY', 'CHALLENGE',
  'STRATEGY', 'TACTICS', 'SKILL', 'LUCK', 'DICE', 'CARD', 'BOARD', 'PIECE',
  'SQUARE', 'CIRCLE', 'TRIANGLE', 'DIAMOND', 'HEXAGON', 'OCTAGON', 'POLYGON',
  'COMPUTER', 'KEYBOARD', 'MOUSE', 'SCREEN', 'BROWSER', 'INTERNET', 'NETWORK',
  'JAVASCRIPT', 'PYTHON', 'RUST', 'GOLANG', 'HTML', 'CSS', 'REACT', 'VUE',
  'MOUNTAIN', 'RIVER', 'OCEAN', 'FOREST', 'DESERT', 'ISLAND', 'VOLCANO',
  'GALAXY', 'PLANET', 'STAR', 'COMET', 'ASTEROID', 'NEBULA', 'UNIVERSE',
  'MUSIC', 'MELODY', 'RHYTHM', 'HARMONY', 'SYMPHONY', 'CONCERT', 'INSTRUMENT',
  'PAINTING', 'SCULPTURE', 'CANVAS', 'BRUSH', 'COLOR', 'PALETTE', 'ARTIST',
  'SCIENCE', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'ASTRONOMY', 'GEOLOGY',
  'HISTORY', 'ANCIENT', 'MEDIEVAL', 'RENAISSANCE', 'EMPIRE', 'KINGDOM',
  'MYSTERY', 'DETECTIVE', 'CLUE', 'EVIDENCE', 'SUSPECT', 'ALIBI', 'CASE',
];

function validState(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s) || !['1', '2'].includes(s.players) ||
      !WORDS.includes(s.word) || !Array.isArray(s.guessed) ||
      !s.guessed.every(ch => typeof ch === 'string' && /^[A-Z]$/.test(ch)) ||
      new Set(s.guessed).size !== s.guessed.length ||
      !Number.isInteger(s.wrong) || s.wrong < 0 || s.wrong >= 6 ||
      s.wrong !== s.guessed.filter(ch => !s.word.includes(ch)).length ||
      s.word.split('').every(ch => s.guessed.includes(ch)) ||
      ![1, 2].includes(s.current) || (s.players === '1' && s.current !== 1) ||
      !s.scores || typeof s.scores !== 'object' || Array.isArray(s.scores) ||
      s.scores[1] !== 0 || s.scores[2] !== 0) return false;
  return true;
}

export default {
  async render(el, game, { navigate, session } = {}) {
    const shell = createShell(el, game, { title: 'Hangman', meta: 'Guess the word, letter by letter' });
    const { stage, getResetButton } = shell;
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('hm-vibe');

    const saved = loadJSON(KEYS.SETTINGS + ':hangman', { players: '1' });
    const restored = validState(session?.state) ? session.state : null;
    const settings = restored ? { players: restored.players } : await renderSetup(stage, {
      title: '📝 Hangman',
      subtitle: 'Choose your players',
      themeClass: 'hm-theme',
      fields: [{
        key: 'players', label: 'Players',
        options: [
          { value: '1', label: 'Solo' },
          { value: '2', label: '2 Players' },
        ],
        default: saved.players,
      }],
      startLabel: 'Start Guessing',
    });
    saveJSON(KEYS.SETTINGS + ':hangman', settings);
    const playerCount = settings.players === '2' ? 2 : 1;
    shell.root.querySelector('.game-meta').textContent = playerCount === 2 ? 'Two players · Take turns guessing' : 'Single player · Guess the word';

    let word = '', guessed = new Set(), wrong = 0, maxWrong = 6, gameOver = false;
    let current = 1, scores = { 1: 0, 2: 0 };
    let busy = false, disposed = false, roundId = 0;
    function checkpoint() {
      session?.save({ players: settings.players, word, guessed: [...guessed], wrong, current, scores: { ...scores } });
    }

    const wordEl = document.createElement('div');
    wordEl.className = 'hm-word';
    stage.appendChild(wordEl);

    const keyboard = document.createElement('div');
    keyboard.className = 'hm-keyboard';
    stage.appendChild(keyboard);

    const figure = document.createElement('div');
    figure.className = 'hm-figure';
    stage.appendChild(figure);

    const status = document.createElement('div');
    status.className = 'hm-status';
    stage.appendChild(status);

    function newGame() {
      roundId++;
      shell.root.querySelector('.arcade-victory')?.remove();
      busy = false;
      word = WORDS[Math.floor(Math.random() * WORDS.length)];
      guessed.clear(); wrong = 0; gameOver = false;
      current = 1; scores = { 1: 0, 2: 0 };
      checkpoint();
      render();
    }

    function render() {
      // Word display
      wordEl.textContent = word.split('').map(ch => guessed.has(ch) ? ch : '₋').join(' ');

      // Keyboard
      keyboard.innerHTML = '';
      const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
      for (const row of rows) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'hm-row';
        for (const ch of row) {
          const btn = document.createElement('button');
          btn.className = 'hm-key';
          btn.textContent = ch;
          btn.disabled = guessed.has(ch) || gameOver;
          if (guessed.has(ch)) btn.classList.add(word.includes(ch) ? 'correct' : 'wrong');
          btn.addEventListener('click', () => onGuess(ch));
          rowDiv.appendChild(btn);
        }
        keyboard.appendChild(rowDiv);
      }

      // Hangman figure
      drawFigure();

      // Status
      if (!gameOver) {
        const p = playerCount === 2 ? ` · P${current}'s turn` : '';
        status.textContent = `Wrong guesses: ${wrong}/${maxWrong}${p}`;
      }
    }

    function drawFigure() {
      const parts = [
        // head
        () => { figure.innerHTML += '<div class="hm-part head"></div>'; },
        // body
        () => { figure.innerHTML += '<div class="hm-part body"></div>'; },
        // left arm
        () => { figure.innerHTML += '<div class="hm-part arm left"></div>'; },
        // right arm
        () => { figure.innerHTML += '<div class="hm-part arm right"></div>'; },
        // left leg
        () => { figure.innerHTML += '<div class="hm-part leg left"></div>'; },
        // right leg
        () => { figure.innerHTML += '<div class="hm-part leg right"></div>'; },
      ];
      figure.innerHTML = '<div class="hm-gallows"></div>';
      for (let i = 0; i < wrong; i++) parts[i]();
    }

    async function onGuess(ch) {
      if (disposed || busy || gameOver || guessed.has(ch)) return;
      busy = true;
      const startedRound = roundId;
      const audio = window.arcadeAudio;
      if (audio) await audio.prepare();
      if (disposed || gameOver || startedRound !== roundId) return;
      busy = false;
      guessed.add(ch);
      const correct = word.includes(ch);
      if (audio) audio.tap();

      if (!correct) {
        wrong++;
        if (audio) audio.buzz();
        if (window.haptics) window.haptics.failure();
      } else {
        if (audio) audio.chime();
        if (window.haptics) window.haptics.success();
      }

      // Check win
      const allGuessed = word.split('').every(ch => guessed.has(ch));
      if (allGuessed) {
        gameOver = true;
        scores[current]++;
        celebrate(shell.root, playerCount === 1 ? 'You found the word!' : `${playerName(current - 1)} found the word!`);
        status.textContent = `🎉 You found "${word}"!`;
      } else if (wrong >= maxWrong) {
        gameOver = true;
        if (audio) audio.buzzer();
        if (window.haptics) window.haptics.failure();
        status.textContent = `💀 Game Over! The word was "${word}"`;
      } else if (playerCount === 2) {
        current = nextPlayer(current, 2);
      }
      if (gameOver) session?.finish();
      else checkpoint();
      render();
    }

    getResetButton().addEventListener('click', newGame);

    const onTheme = () => render();
    window.addEventListener('arcade:themechange', onTheme);
    if (restored) {
      word = restored.word; guessed = new Set(restored.guessed);
      wrong = restored.wrong; current = restored.current; scores = { ...restored.scores };
      render();
    } else newGame();
    return { dispose: () => { disposed = true; window.removeEventListener('arcade:themechange', onTheme); } };
  },
};
