import { KEYS, loadJSON, saveJSON } from './storage.js';

const MAX_PLAYERS = 8;
const MAX_LENGTH = 24;

export function playerName(index, room = null) {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_PLAYERS)
    throw new RangeError('Invalid player seat.');
  if (room?.activeGame?.playerIds[index]) {
    const member = room.members.find(({ id }) => id === room.activeGame.playerIds[index]);
    return member?.name || `Player ${index + 1}`;
  }
  const names = loadJSON(KEYS.PLAYER_NAMES, []);
  return Array.isArray(names) && typeof names[index] === 'string' &&
    names[index].trim() ? names[index].trim().slice(0, MAX_LENGTH) : `Player ${index + 1}`;
}

export function savePlayerNames(names) {
  if (!Array.isArray(names) || names.length > MAX_PLAYERS ||
      names.some(name => typeof name !== 'string' || name.trim().length > MAX_LENGTH))
    throw new TypeError('Player names must be at most 24 characters each.');
  if (!saveJSON(KEYS.PLAYER_NAMES, names.map(name => name.trim())))
    throw new Error('Could not save player names on this device.');
}

export function openNameEditor(count) {
  if (!Number.isInteger(count) || count < 2 || count > MAX_PLAYERS)
    throw new RangeError('Invalid number of players.');
  const dialog = document.createElement('dialog');
  dialog.className = 'player-names-dialog';
  const heading = document.createElement('h2');
  heading.textContent = 'Player names';
  const note = document.createElement('p');
  note.textContent = 'Saved on this device for local games. Room names are chosen when joining.';
  const form = document.createElement('form');
  form.method = 'dialog';
  const fields = [];
  const current = loadJSON(KEYS.PLAYER_NAMES, []);
  for (let i = 0; i < count; i++) {
    const label = document.createElement('label');
    label.textContent = `Player ${i + 1}`;
    const input = document.createElement('input');
    input.name = `player-${i + 1}`;
    input.maxLength = MAX_LENGTH;
    input.placeholder = `Player ${i + 1}`;
    input.value = Array.isArray(current) && typeof current[i] === 'string' ? current[i] : '';
    label.appendChild(input);
    fields.push(input);
    form.appendChild(label);
  }
  const error = document.createElement('p');
  error.className = 'player-names-error';
  error.setAttribute('role', 'alert');
  const actions = document.createElement('div');
  actions.className = 'player-names-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button'; cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => dialog.close());
  const save = document.createElement('button');
  save.type = 'submit'; save.textContent = 'Save names';
  actions.append(cancel, save);
  form.append(error, actions);
  dialog.append(heading, note, form);
  document.body.appendChild(dialog);
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const previous = loadJSON(KEYS.PLAYER_NAMES, []);
      const names = Array.isArray(previous) ? previous.slice(0, MAX_PLAYERS) : [];
      fields.forEach((input, index) => { names[index] = input.value; });
      savePlayerNames(names);
      dialog.close();
    } catch (cause) {
      error.textContent = cause.message;
    }
  });
  dialog.showModal();
}
