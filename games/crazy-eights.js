import { createShell, wireBack } from '../js/game-shell.js';

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_NAMES = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function shuffledDeck() {
  const cards = SUITS.flatMap(suit => RANKS.map(rank => ({ suit, rank })));
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function canPlay(card, top, activeSuit) {
  return card.rank === '8' || card.rank === top.rank || card.suit === activeSuit;
}

export function penalty(cards) {
  return cards.reduce((sum, card) => sum + (card.rank === '8' ? 50 :
    ['J', 'Q', 'K'].includes(card.rank) ? 10 : card.rank === 'A' ? 1 : Number(card.rank)), 0);
}

function validCheckpoint(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.stock) || !Array.isArray(s.discard) ||
      s.discard.length < 1 || !Array.isArray(s.hands) || s.hands.length !== 2 ||
      s.hands.some((hand) => !Array.isArray(hand) || !hand.length) ||
      !SUITS.includes(s.activeSuit) || !Number.isInteger(s.current) || s.current < 0 || s.current > 1 ||
      !['handoff', 'play', 'choose'].includes(s.phase) || typeof s.drawn !== 'boolean' ||
      !Number.isInteger(s.passes) || s.passes < 0 || s.passes > 1 ||
      !Number.isSafeInteger(s.turn) || s.turn < 1 || s.winner !== null ||
      typeof s.ending !== 'string' || s.ending !== '' ||
      !(s.pendingEight === null || (Number.isInteger(s.pendingEight) &&
        s.pendingEight >= 0 && s.pendingEight < s.hands[s.current].length)) ||
      (s.phase === 'choose') !== (s.pendingEight !== null) ||
      s.phase === 'choose' && s.hands[s.current][s.pendingEight].rank !== '8' ||
      s.phase === 'handoff' && s.drawn) return false;
  const cards = [...s.stock, ...s.discard, ...s.hands[0], ...s.hands[1]];
  return cards.length === 52 && cards.every((card) => card && typeof card === 'object' &&
    SUITS.includes(card.suit) && RANKS.includes(card.rank)) &&
    new Set(cards.map((card) => `${card.suit}:${card.rank}`)).size === 52;
}

function sound(kind) {
  const audio = window.arcadeAudio;
  if (audio) void audio.prepare().then(() => audio[kind]()).catch(() => {});
}

function cardElement(card, { hidden = false, playable = false, onClick } = {}) {
  const el = document.createElement(onClick ? 'button' : 'div');
  el.className = `cg-card${hidden ? ' cg-card--back' : card.suit === '♥' || card.suit === '♦' ? ' cg-card--red' : ''}${onClick ? ' cg-card--button' : ''}`;
  if (onClick) {
    el.type = 'button';
    el.disabled = !playable;
    el.addEventListener('click', onClick);
  }
  el.setAttribute('aria-label', hidden ? 'Face-down card' :
    `${card.rank} of ${SUIT_NAMES[card.suit]}${onClick ? playable ? ', play card' : ', cannot play' : ''}`);
  if (hidden) {
    el.innerHTML = '<span aria-hidden="true" class="cg-card-back-mark">✦</span>';
  } else {
    const corner = document.createElement('span');
    corner.className = 'cg-card-corner';
    corner.textContent = `${card.rank}${card.suit}`;
    const middle = document.createElement('span');
    middle.className = 'cg-card-center';
    middle.setAttribute('aria-hidden', 'true');
    middle.textContent = card.suit;
    el.append(corner, middle);
  }
  return el;
}

export default {
  render(el, game, { navigate, session } = {}) {
    const shell = createShell(el, game, {
      title: 'Crazy Eights', meta: 'Two players · pass & play', resetLabel: 'New game',
    });
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('ce-vibe');
    const { stage } = shell;
    const table = document.createElement('div');
    table.className = 'cg-table ce-table';
    stage.appendChild(table);

    let stock, discard, hands, activeSuit, current, phase, drawn, passes, pendingEight, winner, ending;
    let turn = 1;
    let resumePhase = null;
    function checkpoint() {
      if (phase === 'over') session?.finish();
      else session?.save({ stock, discard, hands, activeSuit, current, phase: resumePhase || phase,
        drawn, passes, pendingEight, winner, ending, turn });
    }

    function button(label, handler, quiet = false) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `cg-button${quiet ? ' cg-button--quiet' : ''}`;
      el.textContent = label;
      el.addEventListener('click', handler);
      return el;
    }

    function paragraph(text, className) {
      const el = document.createElement('p');
      el.className = className;
      el.textContent = text;
      return el;
    }

    function begin() {
      stock = shuffledDeck();
      hands = [[], []];
      for (let i = 0; i < 7; i++) {
        hands[0].push(stock.pop());
        hands[1].push(stock.pop());
      }
      const starterIndex = stock.findLastIndex(card => card.rank !== '8');
      discard = [stock.splice(starterIndex, 1)[0]];
      activeSuit = discard[0].suit;
      current = 0;
      phase = 'handoff';
      drawn = false;
      passes = 0;
      pendingEight = null;
      winner = null;
      ending = '';
      turn = 1;
      resumePhase = null;
      render();
      checkpoint();
    }

    function replenish() {
      if (stock.length || discard.length <= 1) return;
      const top = discard.pop();
      stock = discard;
      discard = [top];
      for (let i = stock.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [stock[i], stock[j]] = [stock[j], stock[i]];
      }
    }

    function finishTurn() {
      if (hands[current].length === 0) {
        winner = current;
        ending = `Player ${current + 1} played their last card and wins!`;
        phase = 'over';
        sound('chime');
      } else {
        replenish();
        if (passes === 2 && stock.length === 0) {
          const scores = hands.map(penalty);
          winner = scores[0] === scores[1] ? null : scores[0] < scores[1] ? 0 : 1;
          ending = winner === null
            ? `Blocked game · ${scores[0]} points each. It's a tie!`
            : `Blocked game · Player ${winner + 1} wins with ${scores[winner]} points against ${scores[1 - winner]}!`;
          phase = 'over';
          sound('chime');
        } else {
          current = 1 - current;
          turn++;
          drawn = false;
          pendingEight = null;
          phase = 'handoff';
        }
      }
      render();
      checkpoint();
    }

    function play(index) {
      if (phase !== 'play' || !canPlay(hands[current][index], discard.at(-1), activeSuit)) return;
      if (hands[current][index].rank === '8') {
        pendingEight = index;
        phase = 'choose';
        render();
        checkpoint();
        return;
      }
      const card = hands[current].splice(index, 1)[0];
      discard.push(card);
      activeSuit = card.suit;
      passes = 0;
      sound('tap');
      finishTurn();
    }

    function choose(suit) {
      if (phase !== 'choose' || pendingEight === null || !SUITS.includes(suit)) return;
      const card = hands[current].splice(pendingEight, 1)[0];
      discard.push(card);
      activeSuit = suit;
      pendingEight = null;
      passes = 0;
      sound('tap');
      finishTurn();
    }

    function draw() {
      if (phase !== 'play' || drawn) return;
      replenish();
      if (!stock.length) { render(); return; }
      hands[current].push(stock.pop());
      drawn = true;
      sound('tap');
      render();
      checkpoint();
    }

    function pass() {
      if (phase !== 'play' || (!drawn && (stock.length || discard.length > 1 ||
        hands[current].some(card => canPlay(card, discard.at(-1), activeSuit))))) return;
      passes++;
      sound('tap');
      finishTurn();
    }

    function render() {
      table.replaceChildren();
      const heading = document.createElement('header');
      heading.className = 'cg-table-heading';
      heading.innerHTML = '<span class="cg-eyebrow">PASS & PLAY</span><strong>CRAZY EIGHTS <span aria-hidden="true">✦</span></strong>';
      table.appendChild(heading);
      if (phase === 'handoff') {
        const curtain = document.createElement('div');
        curtain.className = 'ce-curtain';
        curtain.innerHTML = '<div class="ce-curtain-icon" aria-hidden="true">✦</div><h3>Pass the device</h3>';
        curtain.append(
          paragraph(`Player ${current + 1}, it's your turn. Player ${1 - current + 1}, look away!`, 'ce-curtain-instructions'),
          button(`I'm Player ${current + 1} · show my hand`, () => {
            phase = resumePhase || 'play';
            resumePhase = null;
            render();
            checkpoint();
          }),
          paragraph('Your cards stay hidden until you tap the button.', 'cg-rules'),
        );
        table.appendChild(curtain);
      } else if (phase === 'over') {
        const result = document.createElement('div');
        result.className = 'ce-curtain';
        result.innerHTML = `<div class="ce-curtain-icon" aria-hidden="true">★</div><h3>Game over</h3>`;
        result.append(paragraph(ending, 'cg-message'), button('Play again ↗', begin));
        table.appendChild(result);
      } else {
        const opponent = document.createElement('section');
        opponent.className = 'ce-opponent';
        const title = document.createElement('h3');
        title.textContent = `Player ${1 - current + 1} · ${hands[1 - current].length} cards`;
        opponent.appendChild(title);
        const backs = document.createElement('div');
        backs.className = 'cg-card-row ce-opponent-backs';
        backs.setAttribute('aria-label', `${hands[1 - current].length} hidden cards`);
        for (let i = 0; i < Math.min(hands[1 - current].length, 7); i++) {
          const back = cardElement(null, { hidden: true });
          back.setAttribute('aria-hidden', 'true');
          backs.appendChild(back);
        }
        opponent.appendChild(backs);
        table.appendChild(opponent);

        const middle = document.createElement('div');
        middle.className = 'ce-middle';
        const pile = document.createElement('div');
        pile.className = 'ce-pile';
        pile.append(cardElement(null, { hidden: true }), cardElement(discard.at(-1)));
        middle.appendChild(pile);
        middle.appendChild(paragraph(`ACTIVE SUIT · ${SUIT_NAMES[activeSuit].toUpperCase()} ${activeSuit}`, 'ce-active-suit'));
        middle.appendChild(paragraph(`TURN ${turn} · ${stock.length} in draw pile`, 'cg-eyebrow'));
        table.appendChild(middle);

        const message = paragraph(phase === 'choose' ? 'Eight! Choose the next suit.' :
          drawn ? 'Play a card, or pass to the other player.' : 'Match rank or suit. Eights are wild.', 'cg-message');
        message.setAttribute('role', 'status');
        message.setAttribute('aria-live', 'polite');
        table.appendChild(message);
        const hand = document.createElement('section');
        hand.className = 'ce-hand';
        const yourTitle = document.createElement('h3');
        yourTitle.textContent = `Player ${current + 1} · your hand (${hands[current].length})`;
        hand.appendChild(yourTitle);
        const row = document.createElement('div');
        row.className = 'cg-card-row ce-hand-cards';
        hands[current].forEach((card, index) =>
          row.appendChild(cardElement(card, {
            playable: phase === 'play' && canPlay(card, discard.at(-1), activeSuit),
            onClick: () => play(index),
          })));
        hand.appendChild(row);
        table.appendChild(hand);
        const actions = document.createElement('div');
        actions.className = 'cg-actions';
        if (phase === 'choose') {
          for (const suit of SUITS) actions.appendChild(button(`${suit} ${SUIT_NAMES[suit]}`, () => choose(suit)));
        } else {
          if (!drawn && (stock.length || discard.length > 1)) actions.appendChild(button('Draw one +', draw));
          if (drawn || (stock.length === 0 && discard.length === 1 &&
            !hands[current].some(card => canPlay(card, discard.at(-1), activeSuit))))
            actions.appendChild(button('Pass turn →', pass, true));
        }
        table.appendChild(actions);
        table.appendChild(paragraph('Draw once per turn, then play any card or pass. If no cards can be drawn and both players pass, lowest hand points win.', 'cg-rules'));
      }
      (table.querySelector('.ce-hand-cards .cg-card--button:not(:disabled)') ||
        table.querySelector('.cg-button'))?.focus();
    }

    shell.getResetButton().addEventListener('click', begin);
    if (validCheckpoint(session?.state)) {
      const saved = session.state;
      ({ stock, discard, hands, activeSuit, current, drawn, passes, pendingEight,
        winner, ending, turn } = saved);
      resumePhase = saved.phase === 'handoff' ? null : saved.phase;
      phase = 'handoff';
      render();
    } else begin();
    return { dispose: () => shell.root.remove() };
  },
};
