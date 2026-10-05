import { createShell, wireBack, renderSetup } from '../js/game-shell.js';
import { playerName } from '../js/player-names.js';
import { createTurnIndicator } from '../js/turn-indicator.js';
import { celebrate } from '../js/celebration.js';
import { loadJSON, saveJSON, KEYS } from '../js/storage.js';
import { createHangman, guessHangman, validHangmanState, wordCategory, MAX_MISSES } from './hangman-engine.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DRAWING = [
  '<circle class="hm-part hm-chalk" cx="142" cy="67" r="20"/>',
  '<path class="hm-part hm-chalk" d="M142 87v49"/>',
  '<path class="hm-part hm-chalk" d="m142 102-27 23"/>',
  '<path class="hm-part hm-chalk" d="m142 102 27 23"/>',
  '<path class="hm-part hm-chalk" d="m142 136-23 35"/>',
  '<path class="hm-part hm-chalk" d="m142 136 23 35"/>',
];

export default {
  async render(el, game, { navigate, session } = {}) {
    const shell = createShell(el, game, { title: 'Hangman', meta: 'A little word detective work' });
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('hm-vibe');
    const saved = loadJSON(KEYS.SETTINGS + ':hangman', { players: '1' });
    const restored = validHangmanState(session?.state) ? structuredClone(session.state) : null;
    if (session?.state && !restored) console.warn('Saved Hangman round is invalid; starting a new round.');
    const savedPlayers = ['1', '2'].includes(saved?.players) ? saved.players : '1';
    if (saved?.players !== savedPlayers) console.warn('Invalid Hangman player setting; using solo play.');
    const settings = restored ? { players: restored.players } : await renderSetup(shell.stage, {
      title: 'Hangman',
      subtitle: session?.state ? 'Your saved round could not be restored. Start a fresh word.' :
        'Find the hidden word before six misses. Play solo or take turns with a friend.',
      themeClass: 'hm-theme',
      fields: [{ key: 'players', label: 'Players', default: savedPlayers,
        options: [{ value: '1', label: 'Solo' }, { value: '2', label: '2 Players' }] }],
      startLabel: 'Start guessing',
    });
    saveJSON(KEYS.SETTINGS + ':hangman', settings);
    const playerCount = settings.players === '2' ? 2 : 1;
    shell.root.querySelector('.game-meta').textContent = playerCount === 2 ?
      'Two players · alternate guesses' : 'Solo · six misses per word';
    const showTurn = createTurnIndicator(shell.root);
    let state = restored || createHangman(settings.players);
    let outcome = null, busy = false, disposed = false, roundId = 0;
    let feedback = restored ? 'Your word is restored. Pick up where you left off.' :
      'Pick a letter below, or type it on your keyboard.';
    const garden = document.createElement('div');
    garden.className = 'hm-garden';
    garden.innerHTML = `
      <header class="hm-banner">
        <p class="hm-eyebrow">THE WORD GARDEN</p>
        <h3>A little guess. A big discovery.</h3>
        <p>Find every letter. You have six chances to miss.</p>
      </header>
      <div class="hm-layout">
        <div class="hm-play">
          <section class="hm-word-panel game-ui-panel">
            <p class="hm-word-meta"></p>
            <div class="hm-word" role="group"></div>
          </section>
          <section class="hm-key-panel game-ui-panel" aria-label="Choose a letter">
            <div class="hm-keyboard"></div>
            <p class="hm-key-help">Tap a letter or type A–Z. Every matching letter is revealed.</p>
          </section>
        </div>
        <aside>
          <section class="hm-round game-ui-panel" aria-label="Round progress">
            <div class="hm-progress"><strong></strong><div class="hm-lives" aria-hidden="true"></div></div>
            <svg class="hm-drawing" viewBox="0 0 220 210" aria-hidden="true">
              <path class="hm-drawing-frame" d="M25 185h170M57 185V27h85M57 51l25-24"/>
              <g class="hm-drawing-parts"></g>
              <path d="M20 195h180" stroke="#47bd92" stroke-width="4" stroke-linecap="round"/>
            </svg>
            <p class="hm-status" role="status" aria-live="polite" aria-atomic="true"></p>
            <button class="hm-replay game-ui-action" type="button" hidden>Next word</button>
          </section>
          <details class="hm-clue game-ui-panel">
            <summary>Need a clue?</summary>
            <p class="hm-category"></p>
            <p>No penalty. Use the theme to narrow your guesses.</p>
          </details>
        </aside>
      </div>`;
    shell.stage.append(garden);
    const wordEl = garden.querySelector('.hm-word');
    const keyboard = garden.querySelector('.hm-keyboard');
    const status = garden.querySelector('.hm-status');
    const replay = garden.querySelector('.hm-replay');
    const buttons = new Map();
    for (const letter of LETTERS) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'hm-key'; button.textContent = letter;
      button.addEventListener('click', () => void onGuess(letter));
      keyboard.append(button); buttons.set(letter, button);
    }

    function checkpoint() { session?.save(structuredClone(state)); }
    function render() {
      wordEl.replaceChildren();
      wordEl.setAttribute('aria-label', `${state.word.length}-letter word`);
      garden.querySelector('.hm-word-meta').textContent = `${state.word.length} letters · ${playerCount === 2 ?
        `${playerName(state.current - 1)}${outcome ? '' : ' to guess'}` : 'Your word to discover'}`;
      [...state.word].forEach((letter, i) => {
        const found = state.guessed.includes(letter), revealed = Boolean(outcome) || found;
        const tile = document.createElement('span');
        tile.className = `hm-letter${found ? ' is-found' : outcome ? ' is-revealed' : ''}`;
        tile.textContent = revealed ? letter : '_';
        tile.setAttribute('role', 'img');
        tile.setAttribute('aria-label', `Letter ${i + 1}: ${revealed ? letter : 'not yet found'}`);
        wordEl.append(tile);
      });
      for (const [letter, button] of buttons) {
        const used = state.guessed.includes(letter), correct = state.word.includes(letter);
        button.disabled = used || Boolean(outcome) || busy;
        button.className = `hm-key${used ? correct ? ' correct' : ' wrong' : ''}`;
        button.setAttribute('aria-label', used ? `${letter}: ${correct ? 'found' : 'not in the word'}` : `Guess ${letter}`);
      }
      keyboard.setAttribute('aria-busy', String(busy));
      garden.querySelector('.hm-progress strong').textContent = `${MAX_MISSES - state.wrong} misses left`;
      const lives = garden.querySelector('.hm-lives');
      lives.replaceChildren();
      for (let i = 0; i < MAX_MISSES; i++) {
        const leaf = document.createElement('span');
        leaf.className = `hm-life${i < state.wrong ? ' is-lost' : ''}`;
        lives.append(leaf);
      }
      garden.querySelector('.hm-drawing-parts').innerHTML = DRAWING.slice(0, state.wrong).join('');
      garden.querySelector('.hm-category').textContent = `The word belongs to: ${wordCategory(state.word)}.`;
      status.textContent = busy ? 'Getting your letter ready…' : feedback;
      status.dataset.outcome = outcome || '';
      replay.hidden = !outcome;
      if (playerCount === 2) showTurn(state.current - 1, !outcome);
    }

    function newGame() {
      roundId++; busy = false; outcome = null;
      shell.root.querySelector('.arcade-victory')?.remove();
      state = createHangman(settings.players);
      feedback = 'A fresh word is ready. Pick your first letter.';
      garden.querySelector('.hm-clue').open = false;
      checkpoint(); render();
    }

    async function onGuess(letter) {
      if (disposed || busy || outcome || state.guessed.includes(letter)) return;
      const focusedKey = keyboard.contains(document.activeElement);
      busy = true; const startedRound = roundId; render();
      const audio = window.arcadeAudio;
      let soundReady = false;
      if (audio) {
        try { soundReady = await audio.prepare(); }
        catch (error) { console.warn('Hangman sound unavailable; guessing remains enabled.', error); }
      }
      if (disposed || startedRound !== roundId) return;
      busy = false;
      const actor = state.current;
      const result = guessHangman(state, letter);
      state = result.state; outcome = result.outcome;
      if (result.correct) {
        feedback = `${letter} is in the word${result.occurrences > 1 ? ` ${result.occurrences} times` : ''}. Nice find!`;
        if (soundReady) audio.chime();
        window.haptics?.success();
      } else {
        feedback = `${letter} is not in the word. ${MAX_MISSES - state.wrong} misses left.`;
        if (soundReady) audio.buzz();
        window.haptics?.failure();
      }
      if (outcome === 'win') {
        feedback = playerCount === 1 ? `You found ${state.word}! Ready for another word?` :
          `${playerName(actor - 1)} found ${state.word}!`;
        celebrate(shell.root, playerCount === 1 ? 'You found the word!' : `${playerName(actor - 1)} found the word!`);
      } else if (outcome === 'loss') {
        feedback = `The word was ${state.word}. A fresh word is another chance.`;
        if (soundReady) audio.buzzer();
      } else if (playerCount === 2) feedback += ` ${playerName(state.current - 1)} is next.`;
      if (outcome) session?.finish(); else checkpoint();
      render();
      if (focusedKey) {
        if (outcome) replay.focus({ preventScroll: true });
        else {
          const start = LETTERS.indexOf(letter);
          for (let step = 1; step <= LETTERS.length; step++) {
            const next = buttons.get(LETTERS[(start + step) % LETTERS.length]);
            if (!next.disabled) { next.focus({ preventScroll: true }); break; }
          }
        }
      }
    }

    const onKey = event => {
      if (disposed || !shell.root.isConnected || event.ctrlKey || event.metaKey || event.altKey || event.isComposing ||
        event.target instanceof Element && (event.target.closest('input, textarea, select') || event.target.isContentEditable) ||
        document.querySelector('dialog[open], [role="dialog"]:not([hidden]):not([aria-hidden="true"])')) return;
      if (/^[a-z]$/i.test(event.key)) {
        event.preventDefault(); void onGuess(event.key.toUpperCase());
      }
    };
    const onTheme = () => render();
    shell.getResetButton().addEventListener('click', newGame);
    replay.addEventListener('click', () => { newGame(); buttons.get('A').focus({ preventScroll: true }); });
    window.addEventListener('keydown', onKey);
    window.addEventListener('arcade:themechange', onTheme);
    checkpoint(); render();
    return { dispose: () => {
      disposed = true; roundId++;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('arcade:themechange', onTheme);
    } };
  },
};
