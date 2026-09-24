// Static-site multiplayer: signaling is exchanged as two URLs, never sent to a server.
import { GAMES, getGame } from './game-catalog.js';

const VERSION = 1;
const MAX_URL = 16000;
const MAX_PAYLOAD = 120000;
const MAX_MESSAGE = 12000;
const ICE_TIMEOUT = 20000;
const ID = /^[a-f0-9-]{36}$/i;
const GAME_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const REMOTE_GAMES = new Set(['tictactoe', 'connect-four', 'chess', 'rps', 'snakes-ladders', 'ludo', 'uno']);
const GROUP_GAMES = new Set(['snakes-ladders', 'ludo', 'uno']);
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

function fail(message) { throw new Error(message); }
function nameOf(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 40) fail('Enter a name (up to 40 characters).');
  return value.trim();
}
function idOf(value) {
  if (typeof value !== 'string' || !ID.test(value)) fail('Invalid room or participant ID.');
  return value;
}
function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64ToBytes(text) {
  if (typeof text !== 'string' || !text || text.length > MAX_PAYLOAD * 2 || !/^[A-Za-z0-9_-]+$/.test(text) || text.length % 4 === 1) fail('Invalid invitation encoding.');
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - text.length % 4) % 4));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch { fail('Invalid invitation encoding.'); }
}
async function readLimited(stream) {
  const reader = stream.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_PAYLOAD) fail('Invitation payload is too large.');
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
async function encode(value) {
  const raw = encoder.encode(JSON.stringify(value));
  if (raw.length > MAX_PAYLOAD) fail('Connection description is too large to share.');
  if (typeof CompressionStream === 'function') {
    try {
      const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'));
      return `z${bytesToBase64(new Uint8Array(await new Response(stream).arrayBuffer()))}`;
    } catch (error) { console.warn('Link compression unavailable; using an uncompressed invite', error); }
  }
  return `r${bytesToBase64(raw)}`;
}
async function decode(text) {
  if (typeof text !== 'string' || text.length < 2 || text.length > MAX_URL) fail('Invalid or oversized invitation.');
  const bytes = base64ToBytes(text.slice(1));
  let raw;
  if (text[0] === 'r') raw = bytes;
  else if (text[0] === 'z') {
    if (typeof DecompressionStream !== 'function') fail('This browser cannot read compressed invitation links.');
    try { raw = await readLimited(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))); }
    catch { fail('Invalid compressed invitation.'); }
  } else fail('Unknown invitation format.');
  if (raw.length > MAX_PAYLOAD) fail('Invitation payload is too large.');
  try { return JSON.parse(decoder.decode(raw)); }
  catch { fail('Invalid invitation data.'); }
}
function parseLink(input, key) {
  if (typeof input !== 'string' || input.length > MAX_URL || !input.trim()) fail('Missing or oversized link.');
  let url;
  try { url = new URL(input.trim()); } catch { fail('Paste a complete invitation URL.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.origin !== location.origin || url.pathname !== location.pathname) fail('This link belongs to a different arcade page.');
  const values = url.searchParams.getAll(key);
  if (values.length !== 1) fail(`Expected exactly one ${key} parameter.`);
  return values[0];
}
function link(key, value) {
  const url = new URL(location.href);
  url.searchParams.delete('invite');
  url.searchParams.delete('answer');
  url.searchParams.set(key, value);
  url.hash = '#/';
  if (url.href.length > MAX_URL) fail('Link is too large for safe sharing. Try a different browser or network.');
  return url.href;
}
function description(value, type) {
  if (!value || value.type !== type || typeof value.sdp !== 'string' || !value.sdp.startsWith('v=0') || value.sdp.length > MAX_PAYLOAD) fail('Invalid connection description.');
  return { type, sdp: value.sdp };
}
function signal(value, type) {
  if (!value || value.v !== VERSION || value.kind !== type) fail('Unsupported or invalid invitation.');
  idOf(value.room);
  idOf(value.host);
  idOf(value.guest);
  description(value.sdp, type);
  if (type === 'answer') nameOf(value.name);
  return value;
}
function gathered(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('ICE gathering timed out. Try again online.')), ICE_TIMEOUT);
    const onChange = () => { if (pc.iceGatheringState === 'complete') finish(); };
    const finish = (error) => {
      clearTimeout(timeout);
      pc.removeEventListener('icegatheringstatechange', onChange);
      error ? reject(error) : resolve();
    };
    pc.addEventListener('icegatheringstatechange', onChange);
    onChange();
  });
}
function connection() {
  if (typeof RTCPeerConnection !== 'function') fail('WebRTC is unavailable in this browser.');
  return new RTCPeerConnection({
    iceServers: typeof navigator !== 'undefined' && navigator.onLine === false ? [] : [{ urls: 'stun:stun.l.google.com:19302' }],
  });
}
function validPlayers(ids, members) {
  return Array.isArray(ids) && ids.length > 0 && ids.length <= 32 &&
    ids.every((id) => typeof id === 'string' && ID.test(id)) &&
    new Set(ids).size === ids.length &&
    ids.every((id) => members.some((member) => member.id === id && member.connected && member.admitted));
}
function seatLimits(game) {
  return GROUP_GAMES.has(game.id) ? game.players : { min: 2, max: 2 };
}
function validGame(value, members, hostId) {
  const game = getGame(value?.id);
  if (!game || !REMOTE_GAMES.has(game.id)) return false;
  const { min, max } = seatLimits(game);
  return Array.isArray(value.playerIds) &&
    value.playerIds.length >= min && value.playerIds.length <= max &&
    value.playerIds[0] === hostId && validPlayers(value.playerIds, members) &&
    Number.isInteger(value.seed) && value.seed >= 0 && value.seed <= 0xffffffff;
}

export class MultiplayerRoom {
  constructor() {
    this.role = null;
    this.peerId = null;
    this.members = [];
    this.activeGame = null;
    this.roomId = null;
    this.peers = new Map();
    this.listeners = new Set();
    this.lobbies = new Set();
    this.requestId = 0;
    this.actionSequence = 0;
    this.lastActionSequence = 0;
    this.gameGeneration = 0;
    this.lastGameGeneration = 0;
  }
  on(listener) {
    if (typeof listener !== 'function') fail('Listener must be a function.');
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit(event) {
    for (const listener of this.listeners) {
      try { listener(event); } catch (error) { console.error('Multiplayer listener failed', error); }
    }
    if (event.type === 'state' || event.type === 'game') for (const render of this.lobbies) render();
  }
  state() { this.emit({ type: 'state', members: this.members.map((member) => ({ ...member })), activeGame: this.activeGame }); }
  error(error) { this.emit({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
  createHost(name) {
    const localName = nameOf(name);
    this.close();
    this.role = 'host';
    this.peerId = crypto.randomUUID();
    this.roomId = crypto.randomUUID();
    this.members = [{ id: this.peerId, name: localName, connected: true, admitted: true }];
    this.state();
  }
  attach(peer, id, channel) {
    peer.channel = channel;
    channel.onopen = () => {
      if (this.peers.get(id) !== peer) return;
      if (this.role === 'guest') this.send(channel, 'hello', {
        name: this.members.find((member) => member.id === this.peerId)?.name,
      });
      else this.publish();
      this.state();
    };
    channel.onmessage = (event) => this.receive(peer, id, event.data);
    channel.onclose = () => this.disconnected(peer, id);
    channel.onerror = () => this.error(new Error('Data channel error.'));
  }
  disconnected(peer, id) {
    if (this.peers.get(id) !== peer) return;
    const member = this.members.find((person) => person.id === id);
    if (member) member.connected = false;
    if (this.role === 'host') {
      if (this.activeGame?.playerIds.includes(id)) this.returnLobby();
      this.publish();
    } else if (this.role === 'guest') {
      const self = this.members.find((person) => person.id === this.peerId);
      if (self) self.connected = false;
      if (this.activeGame) {
        this.activeGame = null;
        this.emit({ type: 'game', game: null, spectating: false });
      }
    }
    this.state();
  }
  watch(peer, id) {
    peer.pc.onconnectionstatechange = () => {
      const state = peer.pc.connectionState;
      if (state === 'disconnected') {
        if (!peer.disconnectTimer) peer.disconnectTimer = setTimeout(() => {
          peer.disconnectTimer = null;
          if (peer.pc.connectionState === 'disconnected') this.disconnected(peer, id);
        }, 8000);
      } else {
        clearTimeout(peer.disconnectTimer);
        peer.disconnectTimer = null;
        if (state === 'failed' || state === 'closed') this.disconnected(peer, id);
      }
    };
  }
  async createInvite() {
    if (this.role !== 'host') fail('Create a room before inviting guests.');
    if (this.peers.size >= 31) fail('Room is full (32 participants maximum).');
    const guest = crypto.randomUUID();
    const peer = { pc: connection(), channel: null, lastRequest: 0 };
    this.peers.set(guest, peer);
    this.watch(peer, guest);
    try {
      this.attach(peer, guest, peer.pc.createDataChannel('arcade', { ordered: true }));
      await peer.pc.setLocalDescription(await peer.pc.createOffer());
      await gathered(peer.pc);
      if (this.peers.get(guest) !== peer) fail('Invitation was cancelled.');
      return link('invite', await encode({
        v: VERSION, kind: 'offer', room: this.roomId, host: this.peerId, guest,
        sdp: description(peer.pc.localDescription, 'offer'),
      }));
    } catch (error) {
      this.peers.delete(guest);
      peer.pc.close();
      this.error(error);
      throw error;
    }
  }
  async joinInvite(url, name) {
    const localName = nameOf(name);
    const offer = signal(await decode(parseLink(url, 'invite')), 'offer');
    this.close();
    this.role = 'guest';
    this.roomId = offer.room;
    this.peerId = offer.guest;
    this.members = [{ id: this.peerId, name: localName, connected: false, admitted: false }];
    const peer = { pc: connection(), channel: null, lastRequest: 0 };
    this.peers.set(offer.host, peer);
    this.watch(peer, offer.host);
    peer.pc.ondatachannel = (event) => {
      if (event.channel.label !== 'arcade' || peer.channel) { event.channel.close(); return; }
      this.attach(peer, offer.host, event.channel);
    };
    this.state();
    try {
      await peer.pc.setRemoteDescription(description(offer.sdp, 'offer'));
      await peer.pc.setLocalDescription(await peer.pc.createAnswer());
      await gathered(peer.pc);
      if (this.peers.get(offer.host) !== peer) fail('Invitation was cancelled.');
      return link('answer', await encode({
        v: VERSION, kind: 'answer', room: offer.room, host: offer.host, guest: offer.guest,
        name: localName, sdp: description(peer.pc.localDescription, 'answer'),
      }));
    } catch (error) {
      this.close();
      this.error(error);
      throw error;
    }
  }
  async acceptAnswer(url) {
    if (this.role !== 'host') fail('Only the host can accept an answer.');
    const answer = signal(await decode(parseLink(url, 'answer')), 'answer');
    if (answer.room !== this.roomId || answer.host !== this.peerId) fail('Answer belongs to a different room.');
    const peer = this.peers.get(answer.guest);
    if (!peer || peer.pc.signalingState !== 'have-local-offer' || peer.accepting) fail('No pending invitation for this guest.');
    peer.accepting = true;
    try {
      await peer.pc.setRemoteDescription(description(answer.sdp, 'answer'));
      this.members.push({ id: answer.guest, name: nameOf(answer.name), connected: false, admitted: true });
      this.state();
    } catch (error) {
      peer.accepting = false;
      this.error(error);
      throw error;
    }
  }
  async share(url) {
    if (typeof url !== 'string' || url.length > MAX_URL) fail('Invalid or oversized link.');
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try { await navigator.share({ url }); return { method: 'share' }; }
      catch (error) {
        if (error?.name === 'AbortError') return { method: 'cancelled' };
        this.error(error);
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(url); return { method: 'clipboard' }; }
      catch (error) { console.warn('Clipboard unavailable; select and copy the link manually', error); }
    }
    return { method: 'manual', url };
  }
  send(channel, kind, fields = {}) {
    if (channel?.readyState !== 'open') return false;
    const message = JSON.stringify({ v: VERSION, room: this.roomId, id: this.peerId,
      request: `${this.peerId}:${++this.requestId}`, game: this.activeGame?.id ?? null, kind, ...fields });
    if (message.length > MAX_MESSAGE) fail('Message is too large.');
    channel.send(message);
    return true;
  }
  publish() {
    if (this.role !== 'host') return;
    const members = this.members.map(({ id, name, connected, admitted }) => ({ id, name, connected, admitted }));
    for (const peer of this.peers.values()) {
      this.send(peer.channel, 'state', { members, activeGame: this.activeGame, gameGeneration: this.gameGeneration });
    }
  }
  receive(peer, id, raw) {
    try {
      if (this.peers.get(id) !== peer || typeof raw !== 'string' || raw.length > MAX_MESSAGE) fail('Invalid channel message.');
      const msg = JSON.parse(raw);
      const requestNumber = Number(msg?.request?.slice(id.length + 1));
      if (!msg || msg.v !== VERSION || msg.room !== this.roomId || msg.id !== id ||
          typeof msg.request !== 'string' || !msg.request.startsWith(`${id}:`) ||
          !Number.isSafeInteger(requestNumber) || requestNumber <= peer.lastRequest ||
          msg.request !== `${id}:${requestNumber}`) fail('Invalid or duplicate room message.');
      if (this.role === 'host') {
        const member = this.members.find((person) => person.id === id);
        if (!member) fail('Unknown participant.');
        if (msg.kind === 'hello') {
          if (nameOf(msg.name) !== member.name) fail('Participant name mismatch.');
          member.connected = true;
          this.publish();
          this.state();
        } else if (msg.kind === 'action') {
          if (!member.connected || !member.admitted || msg.game !== this.activeGame?.id ||
              !this.activeGame?.playerIds.includes(id)) fail('Participant cannot act in this game.');
          this.checkAction(msg.action);
          if (this.activeGame.id === 'uno') this.emit({ type: 'action', from: id, action: msg.action });
          else this.broadcastAction(id, msg.action);
        } else fail('Guests cannot change room state.');
      } else if (this.role === 'guest') {
        if (msg.kind === 'state') {
          if (!Array.isArray(msg.members) || msg.members.length > 32 ||
              !msg.members.some((person) => person.id === this.peerId) ||
              !msg.members.some((person) => person.id === id) ||
              msg.members.some((person) => !ID.test(person?.id ?? '') ||
                typeof person.name !== 'string' || person.name.length > 40 ||
                typeof person.connected !== 'boolean' || typeof person.admitted !== 'boolean') ||
              new Set(msg.members.map((person) => person.id)).size !== msg.members.length) fail('Invalid room roster.');
          if (msg.activeGame !== null && !validGame(msg.activeGame, msg.members, id))
            fail('Invalid game state.');
          if (msg.game !== (msg.activeGame?.id ?? null) ||
              !Number.isSafeInteger(msg.gameGeneration) ||
              msg.gameGeneration < this.lastGameGeneration) fail('Invalid game identifier.');
          const wasPlaying = this.activeGame?.playerIds.includes(this.peerId);
          const previous = JSON.stringify(this.activeGame);
          const newGeneration = msg.gameGeneration !== this.lastGameGeneration;
          this.members = msg.members.map(({ id: memberId, name, connected, admitted }) =>
            ({ id: memberId, name, connected, admitted }));
          this.activeGame = msg.activeGame ? {
            id: msg.activeGame.id, playerIds: [...msg.activeGame.playerIds], seed: msg.activeGame.seed,
          } : null;
          this.lastGameGeneration = msg.gameGeneration;
          this.state();
          if (this.activeGame?.playerIds.includes(this.peerId) &&
              (newGeneration || JSON.stringify(this.activeGame) !== previous)) {
            this.emit({ type: 'game', game: this.activeGame, spectating: false });
          } else if (wasPlaying && !this.activeGame?.playerIds.includes(this.peerId)) {
            this.emit({ type: 'game', game: null, spectating: true });
          }
        } else if (msg.kind === 'action') {
          if (!this.activeGame || msg.game !== this.activeGame.id ||
              !Number.isSafeInteger(msg.sequence) || msg.sequence <= this.lastActionSequence ||
              !this.activeGame.playerIds.includes(msg.from) ||
              !this.members.some((person) => person.id === msg.from && person.admitted)) fail('Invalid action sender.');
          this.checkAction(msg.action);
          this.lastActionSequence = msg.sequence;
          this.emit({ type: 'action', from: msg.from, action: msg.action, sequence: msg.sequence });
        } else if (msg.kind === 'private-action') {
          if (this.activeGame?.id !== 'uno' || msg.game !== 'uno' ||
              !this.activeGame.playerIds.includes(this.peerId) ||
              !Number.isSafeInteger(msg.sequence) || msg.sequence <= this.lastActionSequence)
            fail('Invalid private game message.');
          this.checkAction(msg.action);
          this.lastActionSequence = msg.sequence;
          this.emit({ type: 'action', from: id, action: msg.action, sequence: msg.sequence });
        } else fail('Unknown host message.');
      }
      peer.lastRequest = requestNumber;
    } catch (error) { this.error(error); }
  }
  checkAction(action) {
    if (!action || typeof action !== 'object' || Array.isArray(action) ||
        typeof action.type !== 'string' || !GAME_ID.test(action.type) ||
        JSON.stringify(action).length > 8000) fail('Invalid game action.');
  }
  broadcastAction(from, action) {
    const sequence = ++this.actionSequence;
    for (const [id, peer] of this.peers) {
      if (this.members.some((member) => member.id === id && member.admitted && member.connected))
        this.send(peer.channel, 'action', { from, action, sequence });
    }
    this.emit({ type: 'action', from, action, sequence });
  }
  sendPrivateAction(recipient, action) {
    if (this.role !== 'host' || this.activeGame?.id !== 'uno' ||
        !this.activeGame.playerIds.includes(recipient)) fail('Invalid private game recipient.');
    this.checkAction(action);
    if (recipient === this.peerId) {
      this.emit({ type: 'action', from: this.peerId, action });
      return;
    }
    const peer = this.peers.get(recipient);
    if (!peer || !this.send(peer.channel, 'private-action', {
      action, sequence: ++this.actionSequence,
    })) fail('Player is not connected.');
  }
  startGame(gameId, playerIds) {
    if (this.role !== 'host') fail('Only the host can start games.');
    const game = getGame(gameId);
    if (typeof gameId !== 'string' || !GAME_ID.test(gameId) || !validPlayers(playerIds, this.members))
      fail('Select a valid game and connected admitted players.');
    if (!REMOTE_GAMES.has(gameId)) fail('This game is local-only; remote play is not supported yet.');
    if (!game) fail('Unknown game.');
    const { min, max } = seatLimits(game);
    if (playerIds.length < min || playerIds.length > max)
      fail('This game does not support the selected player count.');
    if (playerIds[0] !== this.peerId)
      fail('Select the host first, followed by connected admitted guests.');
    this.activeGame = {
      id: gameId, playerIds: [...playerIds], seed: crypto.getRandomValues(new Uint32Array(1))[0],
    };
    this.gameGeneration++;
    this.publish();
    this.state();
    this.emit({ type: 'game', game: this.activeGame, spectating: false });
  }
  returnLobby() {
    if (this.role !== 'host') fail('Only the host can return the room to the lobby.');
    this.activeGame = null;
    this.publish();
    this.state();
    this.emit({ type: 'game', game: null, spectating: false });
  }
  setAdmission(id, admitted) {
    if (this.role !== 'host' || typeof admitted !== 'boolean') fail('Only the host can admit guests.');
    const member = this.members.find((person) => person.id === id && id !== this.peerId);
    if (!member) fail('Unknown guest.');
    member.admitted = admitted;
    if (this.activeGame?.playerIds.includes(id) && !admitted) this.returnLobby();
    this.publish();
    this.state();
  }
  sendAction(action) {
    this.checkAction(action);
    if (!this.activeGame?.playerIds.includes(this.peerId)) fail('You are not playing this game.');
    if (this.role === 'host') {
      if (this.activeGame.id === 'uno') this.emit({ type: 'action', from: this.peerId, action });
      else this.broadcastAction(this.peerId, action);
    }
    else if (this.role === 'guest') {
      if (!this.members.find((member) => member.id === this.peerId)?.admitted) fail('You are spectating.');
      if (!this.send(this.peers.values().next().value?.channel, 'action', { action })) fail('Host is not connected.');
    } else fail('Join a room first.');
  }
  close() {
    const peers = [...this.peers.values()];
    this.peers.clear();
    for (const peer of peers) {
      clearTimeout(peer.disconnectTimer);
      peer.channel?.close();
      peer.pc.close();
    }
    this.role = null;
    this.peerId = null;
    this.roomId = null;
    this.members = [];
    this.activeGame = null;
    this.actionSequence = 0;
    this.lastActionSequence = 0;
    this.gameGeneration = 0;
    this.lastGameGeneration = 0;
    this.state();
  }
  mountLobby(container, catalog, onStart) {
    if (!(container instanceof Element) || !Array.isArray(catalog) || typeof onStart !== 'function')
      fail('Provide a lobby container, game catalog and start callback.');
    const draft = {
      name: '',
      invite: new URL(location.href).searchParams.has('invite') ? location.href : '',
      answer: '', output: '', message: '',
    };
    const render = () => {
      container.replaceChildren();
      const root = document.createElement('section');
      root.className = 'mp-lobby';
      const title = document.createElement('h2');
      title.textContent = 'Multiplayer room';
      root.append(title);
      const notice = document.createElement('p');
      notice.className = 'mp-notice';
      notice.textContent = 'No signaling server: exchange two links manually (invite to guest, answer back to host). Remote peers need internet/STUN; NAT/firewalls may block direct connections (no TURN). Long links may be truncated by messaging apps. Installed game assets work offline; remote connections do not.';
      root.append(notice);
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.textContent = draft.message;
      if (this.role === 'host' && draft.message.startsWith('Answer accepted.') &&
          this.members.some((member) => member.id !== this.peerId && member.connected)) {
        status.textContent = 'Guest connected. Select seats and start a game.';
      } else if (this.role === 'guest' && draft.message.startsWith('Send this answer link back') &&
          this.members.find((member) => member.id === this.peerId)?.connected) {
        status.textContent = 'Connected to host. Waiting for the host to start a game.';
      }
      root.append(status);
      const controls = document.createElement('div');
      controls.className = 'mp-controls';
      root.append(controls);
      const field = (placeholder, key) => {
        const input = document.createElement('input');
        input.placeholder = placeholder;
        input.setAttribute('aria-label', placeholder);
        input.value = draft[key];
        input.addEventListener('input', () => { draft[key] = input.value; });
        controls.append(input);
        return input;
      };
      const button = (text, handler, parent = controls) => {
        const node = document.createElement('button');
        node.type = 'button';
        node.textContent = text;
        node.addEventListener('click', async () => {
          try { await handler(); } catch (error) {
            draft.message = error.message;
            container.querySelector('[role="status"]')?.replaceChildren(document.createTextNode(draft.message));
            this.error(error);
          }
        });
        parent.append(node);
        return node;
      };
      const output = document.createElement('textarea');
      output.readOnly = true;
      output.setAttribute('aria-label', 'Link to copy and send');
      output.className = 'mp-link';
      output.value = draft.output;
      const display = (url, prompt) => {
        draft.output = url;
        draft.message = prompt + (url.length > 4000 ? ' Warning: long links may be truncated; use copy/paste without shortening.' : '');
        const current = container.querySelector('.mp-link');
        if (current) current.value = url;
        container.querySelector('[role="status"]')?.replaceChildren(document.createTextNode(draft.message));
      };
      if (!this.role) {
        const name = field('Your name', 'name');
        button('Host room', () => this.createHost(name.value));
        const invite = field('Paste invite URL', 'invite');
        button('Join and create answer', async () => {
          const answer = await this.joinInvite(invite.value, name.value);
          display(answer, 'Send this answer link back to the host. The connection is not complete until the host accepts it.');
        });
      } else if (this.role === 'host') {
        button('Create guest invite', async () => {
          display(await this.createInvite(), 'Send this invite to one guest, then ask them to send their answer link back.');
        });
        const answer = field('Paste guest answer URL', 'answer');
        button('Accept answer', async () => {
          await this.acceptAnswer(answer.value);
          draft.message = 'Answer accepted. Waiting for a direct connection; this may fail behind a NAT or firewall.';
          container.querySelector('[role="status"]')?.replaceChildren(document.createTextNode(draft.message));
        });
      } else if (!draft.message) status.textContent = this.members.find((member) => member.id === this.peerId)?.connected
        ? 'Connected to host.' : 'Waiting for the host to accept your answer link.';
      if (this.role) {
        button('Share / copy link', async () => {
          if (!draft.output) fail('Create a link first.');
          const result = await this.share(draft.output);
          draft.message = result.method === 'cancelled' ? 'Sharing cancelled; the link is still below.' :
            result.method === 'manual' ? 'Select and copy the link below manually.' :
              `Link ${result.method === 'share' ? 'shared' : 'copied'}. ${this.role === 'host'
                ? 'The guest must send their answer link back to this tab.' : 'The host must paste your answer link into their original tab.'}`;
          container.querySelector('[role="status"]')?.replaceChildren(document.createTextNode(draft.message));
        });
        button('Leave room', () => this.close());
      }
      root.append(output);
      const roster = document.createElement('ul');
      roster.className = 'mp-members';
      for (const member of this.members) {
        const row = document.createElement('li');
        row.textContent = `${member.name} · ${member.connected ? 'connected' : 'waiting'} · ${member.admitted ? 'admitted' : 'spectating'}`;
        if (this.role === 'host' && member.id !== this.peerId) {
          button(member.admitted ? 'Set spectator' : 'Admit', () => this.setAdmission(member.id, !member.admitted), row);
        }
        roster.append(row);
      }
      root.append(roster);
      if (this.activeGame) {
        const current = document.createElement('p');
        current.textContent = `Playing: ${catalog.find((game) => game.id === this.activeGame.id)?.name || this.activeGame.id}` +
          (this.activeGame.playerIds.includes(this.peerId) ? '' : ' · Spectating in lobby');
        root.append(current);
        if (this.role === 'host') button('Return everyone to lobby', () => this.returnLobby(), root);
      }
      if (this.role === 'host') {
        const games = document.createElement('div');
        games.className = 'mp-games';
        const selection = document.createElement('div');
        selection.className = 'mp-selection';
        const hostName = this.members.find((person) => person.id === this.peerId)?.name ?? 'Host';
        selection.append(document.createTextNode(`${hostName} (seat 1) with guests: `));
        const eligibleGuests = this.members.filter((person) =>
          person.id !== this.peerId && person.connected && person.admitted);
        for (const [index, member] of eligibleGuests.entries()) {
          const label = document.createElement('label');
          const check = document.createElement('input');
          check.type = 'checkbox';
          check.value = member.id;
          check.checked = index === 0;
          label.append(check, document.createTextNode(member.name));
          selection.append(label);
        }
        if (!eligibleGuests.length) selection.append(document.createTextNode('Waiting for an admitted guest'));
        root.append(selection);
        const scope = document.createElement('p');
        scope.textContent = 'Host always plays seat 1 (X / Red / White). Select one guest for Tic-Tac-Toe, Connect Four, Chess, or RPS; select 1–3 guests for Snakes & Ladders or Ludo. All other games are local-only.';
        games.append(scope);
        for (const game of catalog) {
          if (!GAME_ID.test(game?.id ?? '')) continue;
          if (!REMOTE_GAMES.has(game.id)) {
            const local = document.createElement('p');
            local.className = 'mp-local-only';
            local.textContent = `${game.name} · Local-only (remote play unavailable)`;
            games.append(local);
            continue;
          }
          const { min, max } = seatLimits(game);
          const start = button(`${game.name} (${min}–${max} players)`, () => {
            const guestIds = [...selection.querySelectorAll('input:checked')].map((input) => input.value);
            if (guestIds.length + 1 < min || guestIds.length + 1 > max)
              fail(`Select ${min - 1}–${max - 1} connected admitted guests for ${game.name}.`);
            this.startGame(game.id, [this.peerId, ...guestIds]);
            onStart(game.id);
          }, games);
          start.disabled = eligibleGuests.length + 1 < min;
        }
        root.append(games);
      }
      container.append(root);
    };
    this.lobbies.add(render);
    render();
    return () => { this.lobbies.delete(render); container.replaceChildren(); };
  }
  async showLobby() {
    if (typeof document === 'undefined') fail('A browser document is required to show the lobby.');
    if (this.overlay?.isConnected) {
      this.overlay.hidden = false;
      return;
    }
    const { navigate } = await import('./router.js');
    if (!document.querySelector('link[href$="css/multiplayer.css"]')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = new URL('../css/multiplayer.css', import.meta.url).href;
      style.dataset.multiplayerStyle = '';
      document.head.append(style);
    }
    const overlay = document.createElement('div');
    overlay.className = 'mp-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Multiplayer room');
    const hide = document.createElement('button');
    hide.type = 'button';
    hide.className = 'mp-hide';
    hide.textContent = 'Hide lobby';
    hide.addEventListener('click', () => { overlay.hidden = true; });
    const content = document.createElement('div');
    overlay.append(hide, content);
    document.body.append(overlay);
    this.overlay = overlay;
    this.mountLobby(content, GAMES, () => {});
    this.on((event) => {
      if (event.type !== 'game' || !overlay.isConnected) return;
      if (!event.game || event.spectating) {
        overlay.hidden = false;
        if (!event.game) navigate(null).catch((error) => this.error(error));
      } else {
        overlay.hidden = true;
        navigate(event.game.id).catch((error) => this.error(error));
      }
    });
  }
}

export const room = new MultiplayerRoom();
