// Static-site multiplayer: signaling is exchanged as two URLs, never sent to a server.
import { GAMES, getGame } from './game-catalog.js';
import { roomQrDataUrl } from './room-qr.js';

const VERSION = 1;
const MAX_URL = 16000;
const MAX_PAYLOAD = 120000;
const MAX_MESSAGE = 32000;
const ICE_TIMEOUT = 20000;
const CONNECT_TIMEOUT = 20000;
const ID = /^[a-f0-9-]{36}$/i;
const GAME_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const REMOTE_GAMES = new Set(['tictactoe', 'connect-four', 'chess', 'rps', 'snakes-ladders', 'ludo', 'uno', 'crazy-eights']);
const GROUP_GAMES = new Set(['snakes-ladders', 'ludo', 'uno']);
const PRIVATE_GAMES = new Set(['uno', 'crazy-eights']);
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

const emptyStats = () => ({ games: [], players: [] });
const counts = () => ({ wins: 0, losses: 0, draws: 0 });
function validCounts(value) {
  return value && ['wins', 'losses', 'draws'].every((key) =>
    Number.isSafeInteger(value[key]) && value[key] >= 0);
}
function validStats(stats, members) {
  if (!stats || !Array.isArray(stats.games) || stats.games.length > REMOTE_GAMES.size ||
      !Array.isArray(stats.players) || stats.players.length > members.length) return false;
  const games = new Map();
  for (const entry of stats.games) {
    if (!entry || !REMOTE_GAMES.has(entry.id) || games.has(entry.id) || !validCounts(entry)) return false;
    games.set(entry.id, entry);
  }
  const totals = new Map([...games.keys()].map((id) => [id, counts()]));
  const players = new Set();
  for (const player of stats.players) {
    if (!player || !members.some((member) => member.id === player.id) ||
        players.has(player.id) || !validCounts(player) ||
        !Array.isArray(player.games) || player.games.length > games.size) return false;
    players.add(player.id);
    const seen = new Set();
    const total = counts();
    for (const entry of player.games) {
      if (!entry || !games.has(entry.id) || seen.has(entry.id) || !validCounts(entry)) return false;
      seen.add(entry.id);
      for (const key of ['wins', 'losses', 'draws']) {
        total[key] += entry[key];
        totals.get(entry.id)[key] += entry[key];
        if (!Number.isSafeInteger(total[key]) || !Number.isSafeInteger(totals.get(entry.id)[key]))
          return false;
      }
    }
    if (['wins', 'losses', 'draws'].some((key) => total[key] !== player[key])) return false;
  }
  return [...games].every(([id, game]) =>
    ['wins', 'losses', 'draws'].every((key) => totals.get(id)[key] === game[key]));
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
    this.stats = emptyStats();
    this.roundKeys = new Set();
    this.connectionIssue = '';
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
  state() { this.emit({ type: 'state', members: this.members.map((member) => ({ ...member })),
    activeGame: this.activeGame, stats: structuredClone(this.stats) }); }
  error(error) { this.emit({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
  connectionProblem(message) {
    this.connectionIssue = message;
    this.state();
    this.error(new Error(message));
  }
  watchConnection(peer, id) {
    clearTimeout(peer.connectTimer);
    peer.connectTimer = setTimeout(() => {
      if (this.peers.get(id) !== peer) return;
      const connected = this.role === 'host'
        ? this.members.find(member => member.id === id)?.connected
        : this.members.find(member => member.id === this.peerId)?.connected;
      if (!connected) this.connectionProblem(this.role === 'guest'
        ? 'Still waiting for the host. Ask them to accept your answer in their original tab. If they already did, a direct connection may be blocked by this network; try another network.'
        : 'Guest admitted, but no direct connection yet. Ask them to keep the original guest tab open; this network may block WebRTC (NAT, firewall or STUN). Try another network. No TURN relay is available.');
    }, this.role === 'guest' ? CONNECT_TIMEOUT * 3 : CONNECT_TIMEOUT);
  }
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
    channel.onerror = () => this.connectionProblem('Direct data channel error on this device. Check the connection and try a new invite if it does not recover.');
  }
  disconnected(peer, id) {
    if (this.peers.get(id) !== peer) return;
    clearTimeout(peer.connectTimer);
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
    this.connectionProblem(navigator.onLine === false
      ? 'This device is offline. Remote rooms need an internet connection; local games still work offline.'
      : 'The direct connection was lost or failed. Check both tabs and try a new invite and answer; this network may block WebRTC.');
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
      this.watchConnection(peer, offer.host);
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
    const member = { id: answer.guest, name: nameOf(answer.name), connected: false, admitted: true };
    this.members.push(member);
    this.state();
    try {
      await peer.pc.setRemoteDescription(description(answer.sdp, 'answer'));
      if (!member.connected) this.watchConnection(peer, answer.guest);
    } catch (error) {
      this.members.splice(this.members.indexOf(member), 1);
      this.peers.delete(answer.guest);
      peer.pc.close();
      peer.accepting = false;
      this.publish();
      this.state();
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
      this.send(peer.channel, 'state', { members, activeGame: this.activeGame,
        gameGeneration: this.gameGeneration, stats: this.stats });
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
          clearTimeout(peer.connectTimer);
          this.connectionIssue = '';
          this.publish();
          this.state();
        } else if (msg.kind === 'action') {
          if (!member.connected || !member.admitted || msg.game !== this.activeGame?.id ||
              !this.activeGame?.playerIds.includes(id)) fail('Participant cannot act in this game.');
          this.checkAction(msg.action);
          if (PRIVATE_GAMES.has(this.activeGame.id)) this.emit({ type: 'action', from: id, action: msg.action });
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
          if (!validStats(msg.stats, msg.members)) fail('Invalid room standings.');
          if (msg.game !== (msg.activeGame?.id ?? null) ||
              !Number.isSafeInteger(msg.gameGeneration) ||
              msg.gameGeneration < this.lastGameGeneration) fail('Invalid game identifier.');
          const wasPlaying = this.activeGame?.playerIds.includes(this.peerId);
          const previous = JSON.stringify(this.activeGame);
          const newGeneration = msg.gameGeneration !== this.lastGameGeneration;
          this.members = msg.members.map(({ id: memberId, name, connected, admitted }) =>
            ({ id: memberId, name, connected, admitted }));
          if (this.members.find(person => person.id === this.peerId)?.connected) {
            clearTimeout(peer.connectTimer);
            this.connectionIssue = '';
          }
          this.stats = structuredClone(msg.stats);
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
          if (!PRIVATE_GAMES.has(this.activeGame?.id) || msg.game !== this.activeGame.id ||
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
    if (this.role !== 'host' || !PRIVATE_GAMES.has(this.activeGame?.id) ||
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
    this.roundKeys.clear();
    this.publish();
    this.state();
    this.emit({ type: 'game', game: this.activeGame, spectating: false });
  }
  recordResult(gameId, winnerIndex, roundKey) {
    if (this.role !== 'host' || !this.activeGame || this.activeGame.id !== gameId ||
        typeof gameId !== 'string' || !REMOTE_GAMES.has(gameId))
      fail('Only the host can record a result for the active game.');
    if (winnerIndex !== null && (!Number.isInteger(winnerIndex) ||
        winnerIndex < 0 || winnerIndex >= this.activeGame.playerIds.length))
      fail('Winner must be an active zero-based seat index or null for a draw.');
    if (!((typeof roundKey === 'string' && roundKey.length > 0 && roundKey.length <= 128) ||
        (Number.isSafeInteger(roundKey) && roundKey >= 0)))
      fail('Round key must be a nonempty string (up to 128 characters) or nonnegative safe integer.');
    const key = `${typeof roundKey}:${roundKey}`;
    if (this.roundKeys.has(key)) return false;
    const players = this.activeGame.playerIds;
    const increments = players.map((id, index) => ({
      id, field: winnerIndex === null ? 'draws' : index === winnerIndex ? 'wins' : 'losses',
    }));
    const game = this.stats.games.find((entry) => entry.id === gameId);
    const delta = counts();
    for (const { field } of increments) delta[field]++;
    if (game && ['wins', 'losses', 'draws'].some((field) =>
      game[field] > Number.MAX_SAFE_INTEGER - delta[field]))
      fail('Room standings have reached the safe integer limit.');
    for (const { id, field } of increments) {
      const player = this.stats.players.find((entry) => entry.id === id);
      const perGame = player?.games.find((entry) => entry.id === gameId);
      if ([player, perGame].some((entry) => entry && entry[field] >= Number.MAX_SAFE_INTEGER))
        fail('Room standings have reached the safe integer limit.');
    }
    const gameStats = game ?? { id: gameId, ...counts() };
    if (!game) this.stats.games.push(gameStats);
    for (const { id, field } of increments) {
      let player = this.stats.players.find((entry) => entry.id === id);
      if (!player) {
        player = { id, ...counts(), games: [] };
        this.stats.players.push(player);
      }
      let perGame = player.games.find((entry) => entry.id === gameId);
      if (!perGame) {
        perGame = { id: gameId, ...counts() };
        player.games.push(perGame);
      }
      player[field]++;
      perGame[field]++;
      gameStats[field]++;
    }
    this.roundKeys.add(key);
    this.publish();
    this.state();
    return true;
  }
  leaderboard() {
    return this.stats.players.map((player) => ({
      ...structuredClone(player),
      name: this.members.find((member) => member.id === player.id)?.name ?? 'Former player',
      connected: this.members.find((member) => member.id === player.id)?.connected ?? false,
    })).sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.draws - a.draws ||
      a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.id.localeCompare(b.id))
      .map((entry, index) => ({ rank: index + 1, ...entry }));
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
      if (PRIVATE_GAMES.has(this.activeGame.id)) this.emit({ type: 'action', from: this.peerId, action });
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
    this.stats = emptyStats();
    this.roundKeys.clear();
    for (const peer of peers) clearTimeout(peer.connectTimer);
    this.connectionIssue = '';
    this.preferredGame = null;
    this.state();
  }
  mountLobby(container, catalog, onStart) {
    if (!(container instanceof Element) || !Array.isArray(catalog) || typeof onStart !== 'function')
      fail('Provide a lobby container, game catalog and start callback.');
    const draft = {
      name: '',
      invite: new URL(location.href).searchParams.has('invite') ? location.href : '',
      answer: '', output: '', outputKind: '', qrVisible: false, message: '',
    };
    let scanning = null;
    const stopScan = () => {
      const current = scanning;
      scanning = null;
      if (!current) return;
      clearTimeout(current.frame);
      current.stream?.getTracks().forEach(track => track.stop());
      current.node.remove();
    };
    const scanInto = async (key, input) => {
      if (typeof BarcodeDetector === 'undefined' || !navigator.mediaDevices?.getUserMedia)
        fail('QR scanning is unavailable in this browser. Paste the link instead.');
      stopScan();
      const scanner = document.createElement('div');
      scanner.className = 'mp-scanner';
      const video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      const feedback = document.createElement('p');
      feedback.textContent = `Point your camera at the ${key} QR code.`;
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel scan';
      cancel.addEventListener('click', stopScan);
      scanner.append(video, feedback, cancel);
      container.querySelector('.mp-controls').append(scanner);
      const current = { node: scanner, frame: 0, stream: null };
      scanning = current;
      try {
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (scanning !== current) { stream.getTracks().forEach(track => track.stop()); return; }
        current.stream = stream;
        video.srcObject = stream;
        await video.play();
        if (scanning !== current) return;
        const detect = async () => {
          if (scanning !== current) return;
          try {
            for (const code of await detector.detect(video)) {
              if (scanning !== current) return;
              try {
                parseLink(code.rawValue, key);
                draft[key] = code.rawValue;
                input.value = code.rawValue;
                stopScan();
                draft.message = `${key === 'answer' ? 'Answer' : 'Invite'} scanned. ${key === 'answer' ? 'Accept answer' : 'Join and create answer'} to continue.`;
                container.querySelector('[role="status"]').textContent = draft.message;
                return;
              } catch (error) { feedback.textContent = error.message; }
            }
          } catch (error) {
            stopScan();
            this.error(error);
            draft.message = `Could not scan QR: ${error.message}. Paste the link instead.`;
            container.querySelector('[role="status"]').textContent = draft.message;
            return;
          }
          if (scanning === current) current.frame = setTimeout(detect, 180);
        };
        current.frame = setTimeout(detect, 180);
      } catch (error) {
        if (scanning === current) stopScan();
        throw new Error(`Camera unavailable: ${error.message}. Paste the link instead.`, { cause: error });
      }
    };
    const render = () => {
      stopScan();
      container.replaceChildren();
      const root = document.createElement('section');
      root.className = 'mp-lobby';
      const title = document.createElement('h2');
      title.textContent = 'Multiplayer room';
      root.append(title);
      const notice = document.createElement('p');
      notice.className = 'mp-notice';
      notice.textContent = 'Connect in two steps: send the invite to your guest, then have them send their answer back to the original host tab. Share either link by QR or URL. Remote play needs internet and a direct WebRTC connection; some networks block it (no relay).';
      root.append(notice);
      const steps = document.createElement('p');
      steps.className = 'mp-steps';
      steps.textContent = !this.role
        ? 'Host: enter your name and create a room. Guest: enter your name, paste or scan the invite, then create an answer.'
        : this.role === 'host'
          ? '1. Create an invite and share its URL or QR. 2. Paste or scan the guest’s answer here in this same tab. 3. Wait for “connected,” then choose their seat.'
          : '1. Share your answer URL or QR with the host. 2. Wait for the host to accept it in their original tab. You are ready when your status says “connected.”';
      root.append(steps);
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.className = 'mp-status';
      status.textContent = draft.message;
      if (this.role === 'host' && draft.message.startsWith('Answer accepted.') &&
          this.members.some((member) => member.id !== this.peerId && member.connected)) {
        status.textContent = 'Guest connected. Select seats and start a game.';
      } else if (this.role === 'guest' &&
          this.members.find((member) => member.id === this.peerId)?.connected) {
        status.textContent = this.activeGame ? 'Connected to host.' :
          'Connected to host. Waiting for the host to start a game.';
      }
      root.append(status);
      if (this.connectionIssue) {
        const warning = document.createElement('p');
        warning.className = 'mp-status mp-status-error';
        warning.setAttribute('role', 'alert');
        warning.textContent = this.connectionIssue;
        root.append(warning);
      }
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
      const display = (url, prompt, kind) => {
        draft.output = url;
        draft.outputKind = kind;
        draft.qrVisible = false;
        draft.message = prompt + (url.length > 4000 ? ' Warning: long links may be truncated; use copy/paste without shortening.' : '');
        render();
      };
      if (!this.role) {
        const name = field('Your name', 'name');
        button('Host room', () => this.createHost(name.value));
        const invite = field('Paste invite URL', 'invite');
        button('Scan invite QR', () => scanInto('invite', invite));
        button('Join and create answer', async () => {
          const answer = await this.joinInvite(invite.value, name.value);
          display(answer, 'Send this answer back to the original host tab. Admission is not connection.', 'answer');
        });
      } else if (this.role === 'host') {
        button('Create guest invite', async () => {
          display(await this.createInvite(), 'Send this invite to one guest; have them return their answer here.', 'invite');
        });
        const answer = field('Paste guest answer URL', 'answer');
        button('Scan answer QR', () => scanInto('answer', answer));
        button('Accept answer', async () => {
          await this.acceptAnswer(answer.value);
          draft.message = 'Answer accepted. Waiting for a direct connection; this may fail behind a NAT or firewall.';
          render();
        });
      } else if (!draft.message && !this.members.find((member) => member.id === this.peerId)?.connected)
        status.textContent = 'Waiting for the host to accept your answer link.';
      if (this.role) {
        button('Share link', async () => {
          if (!draft.output) fail('Create a link first.');
          const result = await this.share(draft.output);
          draft.message = result.method === 'cancelled' ? 'Sharing cancelled; the link is still below.' :
            result.method === 'manual' ? 'Select and copy the link below manually.' :
              `Link ${result.method === 'share' ? 'shared' : 'copied'}. ${this.role === 'host'
                ? 'The guest must send their answer link back to this tab.' : 'The host must paste your answer link into their original tab.'}`;
          container.querySelector('[role="status"]')?.replaceChildren(document.createTextNode(draft.message));
        });
        button('Copy link', async () => {
          if (!draft.output) fail('Create a link first.');
          if (!navigator.clipboard?.writeText) {
            output.focus();
            output.select();
            draft.message = 'Clipboard unavailable. Copy the selected URL manually.';
          } else {
            try {
              await navigator.clipboard.writeText(draft.output);
              draft.message = 'Link copied. Share it with the other player.';
            } catch (error) {
              console.warn('Clipboard unavailable', error);
              output.focus();
              output.select();
              draft.message = 'Clipboard unavailable. Copy the selected URL manually.';
            }
          }
          container.querySelector('[role="status"]').textContent = draft.message;
        });
        button('Leave room', () => this.close());
      }
      if (draft.output && this.role === (draft.outputKind === 'invite' ? 'host' : 'guest')) {
        const sharePanel = document.createElement('div');
        sharePanel.className = 'mp-share-panel';
        const label = document.createElement('h3');
        label.textContent = `${draft.outputKind === 'invite' ? 'Invite for guest' : 'Answer for host'}`;
        sharePanel.append(label, output);
        button(draft.qrVisible ? 'Hide QR' : 'Show QR', () => {
          draft.qrVisible = !draft.qrVisible;
          render();
        }, sharePanel);
        if (draft.qrVisible) {
          try {
            const qr = document.createElement('img');
            qr.className = 'mp-qr';
            qr.alt = `QR code for ${draft.outputKind} link`;
            qr.src = roomQrDataUrl(draft.output);
            sharePanel.append(qr);
          } catch (error) {
            if (!(error instanceof RangeError)) throw error;
            const fallback = document.createElement('p');
            fallback.textContent = error.message;
            sharePanel.append(fallback);
          }
        }
        root.append(sharePanel);
      }
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
      if (this.role) {
        const standings = document.createElement('section');
        standings.className = 'mp-standings';
        const heading = document.createElement('h3');
        heading.textContent = 'Room standings';
        standings.append(heading);
        const leaders = this.leaderboard();
        if (!leaders.length) {
          const empty = document.createElement('p');
          empty.textContent = 'No results yet. Play a game to start the leaderboard.';
          standings.append(empty);
        } else {
          const list = document.createElement('ol');
          list.setAttribute('aria-label', 'Room leaderboard');
          for (const player of leaders) {
            const row = document.createElement('li');
            row.textContent = `${player.name}${player.connected ? '' : ' (offline)'} · ${player.wins} W / ${player.losses} L / ${player.draws} D`;
            list.append(row);
          }
          standings.append(list);
          const breakdown = document.createElement('ul');
          breakdown.className = 'mp-standings-games';
          for (const game of this.stats.games) {
            const row = document.createElement('li');
            row.textContent = `${catalog.find((entry) => entry.id === game.id)?.name ?? game.id}: ${game.wins} W / ${game.losses} L / ${game.draws} D`;
            const detail = document.createElement('ul');
            for (const player of leaders.filter((entry) => entry.games.some((played) => played.id === game.id))) {
              const line = document.createElement('li');
              const result = player.games.find((played) => played.id === game.id);
              line.textContent = `${player.name}: ${result.wins} W / ${result.losses} L / ${result.draws} D`;
              detail.append(line);
            }
            row.append(detail);
            breakdown.append(row);
          }
          standings.append(breakdown);
        }
        root.append(standings);
      }
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
        scope.textContent = 'Host plays seat 1. Choose one guest for two-player games, or 1–3 guests for Snakes & Ladders, Ludo and UNO-inspired. Each card player sees only their own hand.';
        games.append(scope);
        const supported = catalog.filter(game => REMOTE_GAMES.has(game.id));
        supported.sort((a, b) => Number(b.id === this.preferredGame) - Number(a.id === this.preferredGame));
        for (const game of supported) {
          if (!GAME_ID.test(game?.id ?? '')) continue;
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
        const local = document.createElement('p');
        local.className = 'mp-local-only';
        local.textContent = 'Other cabinets are local-only. Blackjack is solo against the dealer.';
        games.append(local);
        root.append(games);
      }
      container.append(root);
    };
    render.stopScan = stopScan;
    if (typeof window !== 'undefined') window.addEventListener('pagehide', stopScan);
    this.lobbies.add(render);
    render();
    return () => {
      stopScan();
      if (typeof window !== 'undefined') window.removeEventListener('pagehide', stopScan);
      this.lobbies.delete(render);
      container.replaceChildren();
    };
  }
  async showLobby(preferredGame = null) {
    if (typeof document === 'undefined') fail('A browser document is required to show the lobby.');
    this.preferredGame = preferredGame && REMOTE_GAMES.has(preferredGame) ? preferredGame : null;
    if (this.overlay?.isConnected) {
      this.overlay.hidden = false;
      for (const render of this.lobbies) render();
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
    hide.addEventListener('click', () => {
      for (const render of this.lobbies) render.stopScan?.();
      overlay.hidden = true;
    });
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
