import { createShell, wireBack } from '../js/game-shell.js';
import { celebrate } from '../js/celebration.js';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function shuffledDeck() {
  const deck = SUITS.flatMap(suit => RANKS.map(rank => ({ suit, rank })));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const { rank } of cards) {
    if (rank === 'A') { aces++; total += 11; }
    else total += ['J', 'Q', 'K'].includes(rank) ? 10 : Number(rank);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}

function sound(kind) {
  const audio = window.arcadeAudio;
  if (audio) void audio.prepare().then(() => audio[kind]()).catch(() => {});
}

function cardElement(card, hidden = false) {
  const el = document.createElement('div');
  el.className = `cg-card${hidden ? ' cg-card--back' : card.suit === '♥' || card.suit === '♦' ? ' cg-card--red' : ''}`;
  el.setAttribute('aria-label', hidden ? 'Face-down card' : `${card.rank} of ${{ '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' }[card.suit]}`);
  if (hidden) {
    el.innerHTML = '<span aria-hidden="true" class="cg-card-back-mark">✦</span>';
  } else {
    const corner = document.createElement('span');
    corner.className = 'cg-card-corner';
    corner.textContent = `${card.rank}${card.suit}`;
    const center = document.createElement('span');
    center.className = 'cg-card-center';
    center.setAttribute('aria-hidden', 'true');
    center.textContent = card.suit;
    el.append(corner, center);
  }
  return el;
}

function validCheckpoint(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.deck) ||
      !Array.isArray(s.dealer) || !Array.isArray(s.player) ||
      s.dealer.length !== 2 || s.player.length < 2 || s.player.length > 11 ||
      s.result !== null || s.doubled !== false ||
      !Number.isSafeInteger(s.round) || s.round < 1 || !s.record || typeof s.record !== 'object' ||
      !['wins', 'losses', 'pushes'].every((key) => Number.isSafeInteger(s.record[key]) && s.record[key] >= 0) ||
      typeof s.record.net !== 'number' || !Number.isFinite(s.record.net) ||
      s.record.wins + s.record.losses + s.record.pushes > s.round - 1 ||
      typeof s.message !== 'string' || s.message.length > 160) return false;
  const cards = [...s.deck, ...s.dealer, ...s.player];
  return cards.length === 52 && cards.every((card) => card && typeof card === 'object' &&
    SUITS.includes(card.suit) && RANKS.includes(card.rank)) &&
    new Set(cards.map((card) => `${card.suit}:${card.rank}`)).size === 52 &&
    handValue(s.player).total < 21 && handValue(s.dealer).total !== 21;
}

export default {
  render(el, game, { navigate, session } = {}) {
    const shell = createShell(el, game, {
      title: 'Blackjack', meta: 'Beat the dealer · dealer stands on soft 17', resetLabel: 'New round',
    });
    if (navigate) wireBack(shell, navigate);
    shell.root.classList.add('bj-vibe');
    const { stage } = shell;
    stage.innerHTML = `
      <div class="cg-table bj-table">
        <header class="cg-table-heading"><span class="cg-eyebrow">THE HOUSE</span><strong>BLACKJACK <span aria-hidden="true">♠</span></strong></header>
        <section class="bj-seat" aria-label="Dealer">
          <div class="bj-seat-head"><h3>Dealer</h3><span class="bj-dealer-score"></span></div>
          <div class="cg-card-row bj-dealer-cards"></div>
        </section>
        <div class="bj-center"><span class="bj-round"></span><p class="cg-message bj-message" role="status" aria-live="polite"></p></div>
        <section class="bj-seat" aria-label="Your hand">
          <div class="bj-seat-head"><h3>Your hand</h3><span class="bj-player-score"></span></div>
          <div class="cg-card-row bj-player-cards"></div>
        </section>
        <div class="cg-actions bj-actions"></div>
        <p class="cg-rules">Closest to 21 wins · Aces count as 1 or 11 · Double draws exactly one card and doubles the stake.</p>
        <div class="bj-record" aria-label="Session results"></div>
      </div>`;

    const dealerCards = stage.querySelector('.bj-dealer-cards');
    const playerCards = stage.querySelector('.bj-player-cards');
    const actions = stage.querySelector('.bj-actions');
    const message = stage.querySelector('.bj-message');
    let deck, dealer, player, result, doubled, round = 0;
    const record = { wins: 0, losses: 0, pushes: 0, net: 0 };
    function checkpoint() {
      if (result !== null) session?.finish();
      else session?.save({ deck, dealer, player, result, doubled, round, record,
        message: message.textContent });
    }

    function draw(hand) { hand.push(deck.pop()); }

    function finish(outcome, description) {
      result = outcome;
      if (outcome === 'win') {
        record.wins++;
        record.net += player.length === 2 && handValue(player).total === 21 && !doubled ? 1.5 : doubled ? 2 : 1;
        celebrate(shell.root, 'You beat the dealer!');
      } else if (outcome === 'loss') {
        record.losses++;
        record.net -= doubled ? 2 : 1;
        sound('buzz');
      } else {
        record.pushes++;
        sound('tap');
      }
      message.textContent = description;
      render();
      checkpoint();
    }

    function settle() {
      while (handValue(dealer).total < 17) draw(dealer);
      const d = handValue(dealer).total;
      const p = handValue(player).total;
      if (d > 21) finish('win', `Dealer busts with ${d}. You win!`);
      else if (p > d) finish('win', `${p} beats ${d}. You win!`);
      else if (p < d) finish('loss', `Dealer's ${d} beats your ${p}.`);
      else finish('push', `${p} to ${d}. Push — stakes returned.`);
    }

    function newRound() {
      shell.root.querySelector('.arcade-victory')?.remove();
      deck = shuffledDeck();
      dealer = [];
      player = [];
      result = null;
      doubled = false;
      round++;
      draw(player); draw(dealer); draw(player); draw(dealer);
      const pNatural = handValue(player).total === 21;
      const dNatural = handValue(dealer).total === 21;
      if (pNatural && dNatural) finish('push', 'Both have blackjack. Push!');
      else if (pNatural) finish('win', 'Natural blackjack! You win 3:2.');
      else if (dNatural) finish('loss', 'Dealer has blackjack.');
      else {
        message.textContent = 'Your move: hit, stand, or double down.';
        render();
        checkpoint();
      }
    }

    function act(action) {
      if (result) return;
      if (action === 'stand') { sound('tap'); settle(); return; }
      if (action === 'double' && player.length !== 2) return;
      if (action === 'double') doubled = true;
      draw(player);
      sound('tap');
      const score = handValue(player).total;
      if (score > 21) finish('loss', `Bust at ${score}. Dealer wins.`);
      else if (action === 'double' || score === 21) settle();
      else {
        message.textContent = `You have ${score}. Hit or stand?`;
        render();
        checkpoint();
      }
    }

    function button(label, handler, secondary = false) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `cg-button${secondary ? ' cg-button--quiet' : ''}`;
      btn.textContent = label;
      btn.addEventListener('click', handler);
      actions.appendChild(btn);
      return btn;
    }

    function render() {
      const done = result !== null;
      dealerCards.replaceChildren(...dealer.map((card, i) => cardElement(card, !done && i === 1)));
      playerCards.replaceChildren(...player.map(card => cardElement(card)));
      stage.querySelector('.bj-dealer-score').textContent = done
        ? `${handValue(dealer).total}${handValue(dealer).soft ? ' · soft' : ''}`
        : `${handValue([dealer[0]]).total} + ?`;
      stage.querySelector('.bj-player-score').textContent = `${handValue(player).total}${handValue(player).soft ? ' · soft' : ''}`;
      stage.querySelector('.bj-round').textContent = `ROUND ${round} · ${deck.length} CARDS LEFT`;
      stage.querySelector('.bj-record').textContent =
        `${record.wins} wins · ${record.losses} losses · ${record.pushes} pushes · ${record.net >= 0 ? '+' : ''}${record.net} units`;
      message.dataset.result = result || '';
      actions.replaceChildren();
      if (done) button('Deal again ↗', newRound);
      else {
        button('Hit +', () => act('hit'));
        button('Stand', () => act('stand'), true);
        if (player.length === 2) button('Double ×2', () => act('double'), true);
      }
      actions.querySelector('button')?.focus();
    }

    shell.getResetButton().addEventListener('click', newRound);
    if (validCheckpoint(session?.state)) {
      const saved = session.state;
      deck = saved.deck; dealer = saved.dealer; player = saved.player;
      result = saved.result; doubled = saved.doubled; round = saved.round;
      Object.assign(record, saved.record);
      message.textContent = saved.message;
      render();
    } else newRound();
    return { dispose: () => shell.root.remove() };
  },
};
