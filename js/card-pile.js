// A pile shows only its public top card; the remaining cards are decorative layers.
export function cardPile(top, { count = null, label = 'Card pile' } = {}) {
  const pile = document.createElement('div');
  const empty = count === 0;
  pile.className = `arcade-card-pile${empty ? ' arcade-card-pile--empty' : count === 1 ? ' arcade-card-pile--single' : ''}`;
  pile.setAttribute('role', 'img');
  pile.setAttribute('aria-label', `${label}${count === null ? '' : `, ${count} card${count === 1 ? '' : 's'}`}`);
  if (empty) {
    const placeholder = document.createElement('div');
    placeholder.className = 'arcade-card-pile-placeholder';
    placeholder.textContent = 'Empty';
    pile.append(placeholder);
  } else {
    top.setAttribute('aria-hidden', 'true');
    pile.append(top);
  }
  return pile;
}

export function cardBack(title, symbol = '✦') {
  const card = document.createElement('div');
  card.className = 'arcade-card-back';
  const mark = document.createElement('span');
  mark.textContent = symbol;
  const name = document.createElement('strong');
  name.textContent = title;
  card.append(mark, name);
  return card;
}
