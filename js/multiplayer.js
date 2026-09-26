// Static-site multiplayer: signaling is exchanged as two URLs, never sent to a server.
import { GAMES, getGame } from './game-catalog.js';
import { roomQrDataUrl } from './room-qr.js';

const VERSION = 1;
const MAX_URL = 16000;
const MAX_PAYLOAD = 120000;
const MAX_MESSAGE = 32000;
const MAX_ACTION = 8000;
const MAX_PRIVATE_CATAN_STATE = 30000;
const ICE_TIMEOUT = 20000;
const CONNECT_TIMEOUT = 20000;
const ID = /^[a-f0-9-]{36}$/i;
const GAME_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const REMOTE_GAMES = new Set(['tictactoe', 'connect-four', 'chess', 'rps', 'snakes-ladders', 'ludo', 'catan', 'uno', 'crazy-eights']);
const GROUP_GAMES = new Set(['snakes-ladders', 'ludo', 'catan', 'uno']);
const PRIVATE_GAMES = new Set(['catan', 'uno', 'crazy-eights']);
const PUBLIC_GAMES = new Set([...REMOTE_GAMES].filter(id => !PRIVATE_GAMES.has(id)));
const HOST_BACKUP_KEY = 'arcade:room:host:v1';
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
function validPlayers(ids, members, requireConnected = true) {
  return Array.isArray(ids) && ids.length > 0 && ids.length <= 32 &&
    ids.every((id) => typeof id === 'string' && ID.test(id)) &&
    new Set(ids).size === ids.length &&
    ids.every((id) => members.some((member) => member.id === id &&
      (!requireConnected || member.connected) && member.admitted));
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
    value.playerIds[0] === hostId && validPlayers(value.playerIds, members, false) &&
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
    this.connectionIssuePeer = null;
    this.isRestored = false;
    this.savedCatan = null;
    this.savedGame = null;
    this.pendingSync = new Set();
    this.readyGameId = null;
    this.restoreHost();
  }
  restoreHost() {
    if (typeof sessionStorage === 'undefined') return;
    let backup;
    try {
      const raw = sessionStorage.getItem(HOST_BACKUP_KEY);
      if (!raw) return;
      backup = JSON.parse(raw);
    } catch (error) {
      console.warn('Could not read the room checkpoint', error);
      return;
    }
    if (![1, 2].includes(backup?.version) || !ID.test(backup.roomId ?? '') ||
        !ID.test(backup.peerId ?? '') || !Array.isArray(backup.members) ||
        backup.members.length < 1 || backup.members.length > 32 ||
        backup.members[0]?.id !== backup.peerId ||
        !backup.members.every(member => ID.test(member?.id ?? '') &&
          typeof member.name === 'string' && member.name.trim() &&
          member.name.length <= 40 && typeof member.admitted === 'boolean') ||
        new Set(backup.members.map(member => member.id)).size !== backup.members.length ||
        (backup.activeGame !== null && !validGame(backup.activeGame, backup.members, backup.peerId)) ||
        !Number.isSafeInteger(backup.generation) || backup.generation < 0 ||
        !validStats(backup.stats, backup.members)) {
      console.warn('Stored room checkpoint is invalid; start a new room.');
      return;
    }
    this.role = 'host';
    this.roomId = backup.roomId;
    this.peerId = backup.peerId;
    this.members = backup.members.map(member => ({
      id: member.id, name: member.name, admitted: member.admitted,
      connected: member.id === backup.peerId,
    }));
    this.stats = backup.stats;
    const gameState = backup.version === 1 ? backup.catanState : backup.gameState;
    this.activeGame = backup.activeGame && gameState ? backup.activeGame : null;
    this.savedGame = this.activeGame ? gameState : null;
    this.savedCatan = this.activeGame?.id === 'catan' ? gameState : null;
    this.gameGeneration = backup.generation;
    this.isRestored = true;
    this.connectionIssue = 'Room restored on this device. Direct connections do not survive a tab reload: send each guest a new invite using Reconnect below.';
  }
  saveHost() {
    if (typeof sessionStorage === 'undefined' || this.role !== 'host') return;
    const activeGame = this.savedGame ? this.activeGame : null;
    try {
      sessionStorage.setItem(HOST_BACKUP_KEY, JSON.stringify({
        version: 2, roomId: this.roomId, peerId: this.peerId,
        members: this.members.map(({ id, name, admitted }) => ({ id, name, admitted })),
        activeGame, gameState: activeGame ? this.savedGame : null,
        generation: this.gameGeneration, stats: this.stats,
      }));
    } catch (error) {
      console.warn('Could not save the room checkpoint; keep this tab open.', error);
      this.error(new Error('Room recovery storage is unavailable. Keep this tab open.'));
    }
  }
  saveGame(gameId, state) {
    if (this.role !== 'host' || this.activeGame?.id !== gameId ||
        !REMOTE_GAMES.has(gameId) || !state || typeof state !== 'object' ||
        JSON.stringify(state).length > MAX_MESSAGE)
      fail('Invalid host game checkpoint.');
    this.savedGame = structuredClone(state);
    this.savedCatan = gameId === 'catan' ? this.savedGame : null;
    this.saveHost();
    if (PUBLIC_GAMES.has(gameId)) {
      for (const id of this.pendingSync) {
        if (this.members.some(member => member.id === id && member.connected))
          this.sendRoomState(id);
      }
      this.pendingSync.clear();
    }
  }
  saveCatan(state) { this.saveGame('catan', state); }
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
  state() { this.saveHost(); this.emit({ type: 'state', members: this.members.map((member) => ({ ...member })),
    activeGame: this.activeGame, stats: structuredClone(this.stats) }); }
  error(error) { this.emit({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
  connectionProblem(message, id) {
    this.connectionIssue = message;
    this.connectionIssuePeer = id;
    this.state();
    this.error(new Error(message));
  }
  clearConnectionProblem(id) {
    if (this.connectionIssuePeer !== id) return;
    this.connectionIssue = '';
    this.connectionIssuePeer = null;
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
        : `${this.members.find(member => member.id === id)?.name ?? 'Guest'} admitted, but no direct connection yet. Ask them to keep the original guest tab open; this network may block WebRTC (NAT, firewall or STUN). Try another network. No TURN relay is available.`, id);
    }, this.role === 'guest' ? CONNECT_TIMEOUT * 3 : CONNECT_TIMEOUT);
  }
  createHost(name) {
    const localName = nameOf(name);
    this.close();
    this.role = 'host';
    this.peerId = crypto.randomUUID();
    this.roomId = crypto.randomUUID();
    this.members = [{ id: this.peerId, name: localName, connected: true, admitted: true }];
    this.isRestored = false;
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
    channel.onerror = () => this.connectionProblem('Direct data channel error on this device. Check the connection and try a new invite if it does not recover.', id);
  }
  disconnected(peer, id) {
    if (this.peers.get(id) !== peer || peer.connectionLost) return;
    peer.connectionLost = true;
    clearTimeout(peer.connectTimer);
    const member = this.members.find((person) => person.id === id);
    if (member) member.connected = false;
    if (this.role === 'host') {
      this.publish();
    } else if (this.role === 'guest') {
      const self = this.members.find((person) => person.id === this.peerId);
      if (self) self.connected = false;
    }
    this.connectionProblem(navigator.onLine === false
      ? 'This device is offline. Remote rooms need an internet connection; local games still work offline.'
      : `${member?.name ?? 'Pending guest'} lost the direct connection. Keep both tabs open; if it does not recover, exchange a new invite and answer. This network may block WebRTC.`, id);
  }
  watch(peer, id) {
    peer.pc.onconnectionstatechange = () => {
      const state = peer.pc.connectionState;
      if (state === 'disconnected') {
        peer.wasDisconnected = true;
        if (!peer.disconnectTimer) peer.disconnectTimer = setTimeout(() => {
          peer.disconnectTimer = null;
          if (peer.pc.connectionState === 'disconnected') this.disconnected(peer, id);
        }, 8000);
      } else {
        clearTimeout(peer.disconnectTimer);
        peer.disconnectTimer = null;
        if (state === 'failed' || state === 'closed') this.disconnected(peer, id);
        else if (state === 'connected' && peer.wasDisconnected && peer.channel?.readyState === 'open') {
          peer.wasDisconnected = false;
          peer.connectionLost = false;
          if (this.role === 'host') {
            const member = this.members.find(person => person.id === id);
            if (member?.connected === false && peer.verifiedHello) member.connected = true;
            this.clearConnectionProblem(id);
            this.publish();
            this.state();
          } else if (this.role === 'guest') {
            this.send(peer.channel, 'hello', {
              name: this.members.find(person => person.id === this.peerId)?.name,
            });
          }
        }
      }
    };
  }
  async createInvite(reconnectingId = null) {
    if (this.role !== 'host') fail('Create a room before inviting guests.');
    const existing = reconnectingId === null ? null :
      this.members.find(member => member.id === reconnectingId && member.id !== this.peerId);
    if (reconnectingId !== null && (!existing || existing.connected))
      fail('Only a disconnected guest can be re-invited.');
    if (reconnectingId === null && this.members.length >= 32) fail('Room is full (32 participants maximum).');
    const guest = reconnectingId ?? crypto.randomUUID();
    const peer = { pc: connection(), channel: null, lastRequest: 0 };
    const old = this.peers.get(guest);
    this.peers.set(guest, peer);
    if (old) {
      clearTimeout(old.connectTimer);
      clearTimeout(old.disconnectTimer);
      old.channel?.close();
      old.pc.close();
    }
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
    const member = this.members.find(person => person.id === answer.guest);
    if (member && (member.connected || member.name !== nameOf(answer.name)))
      fail('Reconnect with the same guest name in the original room.');
    const admitted = member ?? { id: answer.guest, name: nameOf(answer.name), connected: false, admitted: true };
    if (!member) this.members.push(admitted);
    this.state();
    try {
      await peer.pc.setRemoteDescription(description(answer.sdp, 'answer'));
      if (!admitted.connected) this.watchConnection(peer, answer.guest);
    } catch (error) {
      if (!member) this.members.splice(this.members.indexOf(admitted), 1);
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
          peer.verifiedHello = true;
          peer.connectionLost = false;
          clearTimeout(peer.connectTimer);
          this.clearConnectionProblem(id);
          this.publish();
          this.state();
        } else if (msg.kind === 'action') {
          if (!member.connected || !member.admitted || msg.game !== this.activeGame?.id ||
              !this.activeGame?.playerIds.includes(id)) fail('Participant cannot act in this game.');
          this.checkAction(msg.action);
          if (msg.action.type === 'room-state') fail('Only the host can send game state.');
          if (this.isRestored && this.readyGameId !== this.activeGame.id &&
              !['ct-sync', 'uno-sync', 'crazy-eights-sync', 'room-sync'].includes(msg.action.type)) {
            this.send(peer.channel, 'error', { message: 'The host must resume the saved game before play continues.' });
          } else if (msg.action.type === 'room-sync' && PUBLIC_GAMES.has(this.activeGame.id)) {
            if (this.savedGame) this.sendRoomState(id);
            else this.pendingSync.add(id);
          } else if (PRIVATE_GAMES.has(this.activeGame.id)) this.emit({ type: 'action', from: id, action: msg.action });
          else this.broadcastAction(id, msg.action);
        } else fail('Guests cannot change room state.');
      } else if (this.role === 'guest') {
        if (msg.kind === 'error') {
          if (msg.game !== this.activeGame?.id ||
              msg.message !== 'The host must resume the saved game before play continues.')
            fail('Invalid host error.');
          this.error(new Error(msg.message));
        } else if (msg.kind === 'state') {
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
          const wasConnected = this.members.find(person => person.id === this.peerId)?.connected;
          const previous = JSON.stringify(this.activeGame);
          const newGeneration = msg.gameGeneration !== this.lastGameGeneration;
          this.members = msg.members.map(({ id: memberId, name, connected, admitted }) =>
            ({ id: memberId, name, connected, admitted }));
          if (this.members.find(person => person.id === this.peerId)?.connected) {
            clearTimeout(peer.connectTimer);
            this.clearConnectionProblem(id);
          }
          this.stats = structuredClone(msg.stats);
          this.activeGame = msg.activeGame ? {
            id: msg.activeGame.id, playerIds: [...msg.activeGame.playerIds], seed: msg.activeGame.seed,
          } : null;
          this.lastGameGeneration = msg.gameGeneration;
          this.state();
          if (!wasConnected && this.members.find(person => person.id === this.peerId)?.connected)
            this.emit({ type: 'reconnected' });
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
          if (!this.activeGame || msg.game !== this.activeGame.id ||
              !this.activeGame.playerIds.includes(this.peerId) ||
              !(PRIVATE_GAMES.has(this.activeGame.id) ||
                PUBLIC_GAMES.has(this.activeGame.id) && msg.action?.type === 'room-state') ||
              !Number.isSafeInteger(msg.sequence) || msg.sequence <= this.lastActionSequence)
            fail('Invalid private game message.');
          this.checkAction(msg.action, this.activeGame.id === 'catan');
          this.lastActionSequence = msg.sequence;
          this.emit({ type: 'action', from: id, action: msg.action, sequence: msg.sequence });
        } else fail('Unknown host message.');
      }
      peer.lastRequest = requestNumber;
    } catch (error) { this.error(error); }
  }
  checkAction(action, privateCatanState = false) {
    if (!action || typeof action !== 'object' || Array.isArray(action) ||
        typeof action.type !== 'string' || !GAME_ID.test(action.type) ||
        JSON.stringify(action).length > (privateCatanState && action.type === 'ct-state'
          ? MAX_PRIVATE_CATAN_STATE : MAX_ACTION)) fail('Invalid game action.');
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
    this.checkAction(action, this.activeGame.id === 'catan');
    if (recipient === this.peerId) {
      this.emit({ type: 'action', from: this.peerId, action });
      return;
    }
    const peer = this.peers.get(recipient);
    if (!peer || !this.send(peer.channel, 'private-action', {
      action, sequence: ++this.actionSequence,
    })) fail('Player is not connected.');
  }
  sendRoomState(recipient) {
    if (this.role !== 'host' || !PUBLIC_GAMES.has(this.activeGame?.id) ||
        !this.activeGame.playerIds.includes(recipient) || !this.savedGame)
      fail('Invalid game state recipient.');
    const action = { type: 'room-state', state: this.savedGame };
    this.checkAction(action);
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
    this.savedCatan = null;
    this.savedGame = null;
    this.pendingSync.clear();
    this.readyGameId = null;
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
    this.savedCatan = null;
    this.savedGame = null;
    this.pendingSync.clear();
    this.readyGameId = null;
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
    if (!['ct-sync', 'uno-sync', 'crazy-eights-sync', 'room-sync'].includes(action.type) &&
        this.activeGame.playerIds.some(id => !this.members.find(member => member.id === id)?.connected))
      fail('A player is disconnected. Wait for them to reconnect before continuing.');
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
    this.savedCatan = null;
    this.savedGame = null;
    this.pendingSync.clear();
    this.readyGameId = null;
    this.isRestored = false;
    if (typeof sessionStorage !== 'undefined') {
      try { sessionStorage.removeItem(HOST_BACKUP_KEY); }
      catch (error) { console.warn('Could not remove the room checkpoint', error); }
    }
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
    this.connectionIssuePeer = null;
    this.preferredGame = null;
    this.state();
  }
  mountLobby(container, catalog, onStart) {
    if (!(container instanceof Element) || !Array.isArray(catalog) || typeof onStart !== 'function')
      fail('Provide a lobby container, game catalog and start callback.');
    const draft = {
      name: '',
      invite: new URL(location.href).searchParams.has('invite') ? location.href : '',
      answer: new URL(location.href).searchParams.has('answer') ? location.href : '',
      mode: new URL(location.href).searchParams.has('invite') ? 'join' : null,
      output: '', outputKind: '', qrVisible: false, message: '', excludedSeats: new Set(),
      creatingInvite: false,
    };
    let scanning = null;
    const stopScan = () => {
      const current = scanning;
      scanning = null;
      if (!current) return;
      current.scanner?.destroy();
      current.node.remove();
    };
    const scanInto = async (key, input) => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
        fail('Camera scanning requires HTTPS (or localhost) and camera access. Open the arcade securely, or paste the link instead.');
      stopScan();
      const scanner = document.createElement('div');
      scanner.className = 'mp-scanner';
      const video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      const feedback = document.createElement('p');
      feedback.textContent = `Fit the entire ${key} QR code inside the camera view.`;
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel scan';
      cancel.addEventListener('click', stopScan);
      scanner.append(video, feedback, cancel);
      container.querySelector('.mp-controls').append(scanner);
      const current = { node: scanner, scanner: null };
      scanning = current;
      try {
        const { default: QrScanner } = await import('./vendor/qr-scanner.min.js');
        if (scanning !== current) return;
        current.scanner = new QrScanner(video, ({ data }) => {
          if (scanning !== current) return;
          try {
            parseLink(data, key);
            draft[key] = data;
            input.value = data;
            stopScan();
            draft.message = `${key === 'answer' ? 'Answer' : 'Invite'} scanned. ${key === 'answer' ? 'Accept answer' : 'Join and create answer'} to continue.`;
            container.querySelector('[role="status"]').textContent = draft.message;
          } catch (error) {
            feedback.textContent = error.message;
          }
        }, {
          preferredCamera: 'environment',
          maxScansPerSecond: 10,
          returnDetailedScanResult: true,
          calculateScanRegion: (source) => {
            const size = Math.min(source.videoWidth, source.videoHeight);
            const resolution = Math.min(size, 600);
            return {
              x: (source.videoWidth - size) / 2,
              y: (source.videoHeight - size) / 2,
              width: size,
              height: size,
              downScaledWidth: resolution,
              downScaledHeight: resolution,
            };
          },
          onDecodeError: (error) => {
            if (error !== QrScanner.NO_QR_CODE_FOUND && scanning === current)
              feedback.textContent = `Could not read QR: ${error.message ?? error}. Try better lighting or paste the link.`;
          },
        });
        await current.scanner.start();
      } catch (error) {
        if (scanning === current) stopScan();
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Camera scanning failed: ${detail} Check camera permission, or paste the link instead.`, { cause: error });
      }
    };
    const render = () => {
      stopScan();
      container.replaceChildren();
      const root = document.createElement('section');
      root.className = 'mp-lobby';
      const title = document.createElement('h2');
      title.textContent = this.role === 'host' ? 'Your room' :
        this.role === 'guest' ? 'Joining the room' :
          draft.mode === 'create' ? 'Create a room' : draft.mode === 'join' ? 'Join a room' : 'Play together';
      root.append(title);
      const steps = document.createElement('p');
      steps.className = 'mp-steps';
      const pending = this.role === 'host' && [...this.peers.values()].some(
        (peer) => peer.pc.signalingState === 'have-local-offer' && !peer.accepting);
      const connectedGuests = this.role === 'host' && this.members.some(
        (member) => member.id !== this.peerId && member.connected && member.admitted);
      const guestConnected = this.role === 'guest' &&
        this.members.find((member) => member.id === this.peerId)?.connected;
      steps.textContent = this.role === 'host'
        ? draft.creatingInvite ? 'Preparing a unique invite for your guest…' :
          pending ? '1. Share this guest’s invite QR or link. 2. Scan or paste their answer below in this same tab.' :
          this.activeGame && this.activeGame.playerIds.some(id =>
            !this.members.find(member => member.id === id)?.connected)
            ? 'Game paused. Reconnect each offline player to their original seat; play resumes when everyone is connected.' :
          connectedGuests ? 'Everyone connected is selected to play. Choose a game below, or invite another friend.' :
            'Create an invite for each guest, then scan or paste their answer in this tab.'
        : this.role === 'guest'
          ? guestConnected ? 'Connected! The host will choose a game. Keep this tab open to play.' :
            'Share your answer QR or link with the host. Keep this tab open while they accept it.'
          : draft.mode === 'create' ? 'Give yourself a name to open a room.' :
            draft.mode === 'join' ? 'Scan or paste the host’s invite, enter your name, then send your answer back.' :
              'Make a room for friends, or join one with an invite.';
      root.append(steps);
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.className = 'mp-status';
      status.textContent = draft.message;
      if (this.role === 'host' && draft.message.startsWith('Answer accepted.') && connectedGuests) {
        status.textContent = 'Guest connected. Select seats and start a game.';
      } else if (guestConnected) {
        status.textContent = this.activeGame ? 'Connected to host.' :
          'Connected to host. Waiting for the host to start a game.';
        if (draft.outputKind === 'answer') draft.output = '';
      }
      root.append(status);
      if (this.connectionIssue) {
        const warning = document.createElement('p');
        warning.className = 'mp-status mp-status-error';
        warning.setAttribute('role', 'alert');
        warning.textContent = this.connectionIssue;
        root.append(warning);
      }
      const help = document.createElement('details');
      help.className = 'mp-help';
      const summary = document.createElement('summary');
      summary.textContent = 'How does connecting work?';
      const explanation = document.createElement('p');
      explanation.textContent = 'Each guest gets a separate invite URL or QR and sends an answer URL or QR back. The host accepts it in the original tab. Keep both tabs open. Camera scanning requires HTTPS; direct play needs internet and may be blocked by some networks (no TURN relay).';
      help.append(summary, explanation);
      root.append(help);
      const controls = document.createElement('div');
      controls.className = 'mp-controls';
      root.append(controls);
      const field = (placeholder, key) => {
        const label = document.createElement('label');
        label.className = 'mp-field';
        const caption = document.createElement('span');
        caption.textContent = placeholder;
        const input = document.createElement('input');
        input.placeholder = placeholder;
        input.value = draft[key];
        input.addEventListener('input', () => { draft[key] = input.value; });
        label.append(caption, input);
        controls.append(label);
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
        draft.qrVisible = true;
        draft.message = prompt + (url.length > 4000 ? ' Warning: long links may be truncated; use copy/paste without shortening.' : '');
        render();
      };
      const makeInvite = async (prompt, reconnectingId = null) => {
        draft.creatingInvite = true;
        render();
        try {
          const url = await this.createInvite(reconnectingId);
          draft.creatingInvite = false;
          display(url, prompt, 'invite');
        } catch (error) {
          draft.creatingInvite = false;
          render();
          throw error;
        }
      };
      if (!this.role) {
        if (draft.answer) {
          const hint = document.createElement('p');
          hint.className = 'mp-notice';
          hint.textContent = 'This is an answer link. Paste or scan it in the original host tab, where the invite was created.';
          root.append(hint);
        }
        if (!draft.mode) {
          const choices = document.createElement('div');
          choices.className = 'mp-choices';
          button('Create a room', () => { draft.mode = 'create'; render(); }, choices);
          button('Join a room', () => { draft.mode = 'join'; render(); }, choices);
          controls.append(choices);
        } else {
          const name = field('Your name', 'name');
          if (draft.mode === 'create') {
            button('Create room', async () => {
              this.createHost(name.value);
              await makeInvite('Share this invite with your first guest. Have them send their answer here.');
            });
          } else {
            const invite = field('Paste invite URL', 'invite');
            button('Scan invite QR', () => scanInto('invite', invite));
            button('Join and create answer', async () => {
              const answer = await this.joinInvite(invite.value, name.value);
              display(answer, 'Send this answer to the original host tab. Wait until connected before playing.', 'answer');
            });
          }
          button('Back to choices', () => { draft.mode = null; draft.message = ''; render(); });
        }
      } else if (this.role === 'host') {
        if (!pending && !draft.creatingInvite && !this.activeGame)
          button('Invite another guest', () =>
            makeInvite('Share this invite with your next guest. Have them send their answer here.'));
        if (!pending && !draft.creatingInvite)
          for (const member of this.members.filter(person =>
            person.id !== this.peerId && !person.connected && person.admitted))
            button(`Reconnect ${member.name}`, () => makeInvite(
              `Send this new invite to ${member.name}. They can rejoin with the same name and keep their seat.`,
              member.id));
        if (pending) {
          const answer = field('Paste guest answer URL', 'answer');
          button('Scan answer QR', () => scanInto('answer', answer));
          button('Accept answer', async () => {
            await this.acceptAnswer(answer.value);
            draft.answer = '';
            draft.message = 'Answer accepted. Waiting for a direct connection; this may fail behind a NAT or firewall.';
            render();
          });
        }
      } else if (!draft.message && !guestConnected)
        status.textContent = 'Waiting for the host to accept your answer link.';
      if (this.role) {
        const leave = button('Leave room', () => {
          draft.mode = null;
          draft.output = '';
          draft.message = '';
          draft.excludedSeats.clear();
          this.close();
        });
        leave.className = 'mp-leave';
      }
      if (draft.output && (this.role === 'host' && draft.outputKind === 'invite' && pending ||
          this.role === 'guest' && draft.outputKind === 'answer' && !guestConnected)) {
        const sharePanel = document.createElement('div');
        sharePanel.className = 'mp-share-panel';
        const label = document.createElement('h3');
        label.textContent = `${draft.outputKind === 'invite' ? 'Invite for guest' : 'Answer for host'}`;
        sharePanel.append(label, output);
        button('Share link', async () => {
          const result = await this.share(draft.output);
          draft.message = result.method === 'cancelled' ? 'Sharing cancelled; the link is still below.' :
            result.method === 'manual' ? 'Select and copy the link below manually.' :
              `Link ${result.method === 'share' ? 'shared' : 'copied'}. ${this.role === 'host'
                ? 'The guest must send their answer link back to this tab.' : 'The host must paste your answer link into their original tab.'}`;
          container.querySelector('[role="status"]')?.replaceChildren(document.createTextNode(draft.message));
        }, sharePanel);
        button('Copy link', async () => {
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
        }, sharePanel);
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
          button(member.admitted ? 'Remove from games' : 'Admit to games',
            () => this.setAdmission(member.id, !member.admitted), row);
        }
        roster.append(row);
      }
      if (this.role && (this.members.length > 1 || this.role === 'guest' && guestConnected)) {
        if (this.role === 'host') {
          const access = document.createElement('details');
          access.className = 'mp-help mp-access';
          const summary = document.createElement('summary');
          summary.textContent = 'Manage room access';
          access.append(summary, roster);
          root.append(access);
        } else {
          const heading = document.createElement('h3');
          heading.textContent = 'Players';
          root.append(heading, roster);
        }
      }
      if (this.role && this.stats.games.length) {
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
        if (this.role === 'host' && this.isRestored)
          button(`Resume saved ${catalog.find(game => game.id === this.activeGame.id)?.name ?? 'game'}`, () => {
            this.emit({ type: 'game', game: this.activeGame, spectating: false });
          }, root);
      }
      if (this.role === 'host' && connectedGuests && !this.activeGame) {
        const games = document.createElement('div');
        games.className = 'mp-games';
        const selection = document.createElement('section');
        selection.className = 'mp-selection';
        const seatTitle = document.createElement('h3');
        seatTitle.textContent = 'Who’s playing?';
        const seatHint = document.createElement('p');
        seatHint.className = 'mp-seat-hint';
        seatHint.textContent = 'Connected guests join automatically. Uncheck anyone who is watching this round.';
        const seatList = document.createElement('div');
        seatList.className = 'mp-seat-list';
        const hostName = this.members.find((person) => person.id === this.peerId)?.name ?? 'Host';
        const hostSeat = document.createElement('span');
        hostSeat.className = 'mp-seat mp-seat-host';
        hostSeat.textContent = `${hostName} · Host · Seat 1`;
        seatList.append(hostSeat);
        const eligibleGuests = this.members.filter((person) =>
          person.id !== this.peerId && person.connected && person.admitted);
        for (const member of eligibleGuests) {
          const label = document.createElement('label');
          label.className = 'mp-seat';
          const check = document.createElement('input');
          check.type = 'checkbox';
          check.value = member.id;
          check.checked = !draft.excludedSeats.has(member.id);
          check.addEventListener('change', () => {
            if (check.checked) draft.excludedSeats.delete(member.id);
            else draft.excludedSeats.add(member.id);
            render();
          });
          label.append(check, document.createTextNode(member.name));
          seatList.append(label);
        }
        const selectedCount = 1 + eligibleGuests.filter(member => !draft.excludedSeats.has(member.id)).length;
        const count = document.createElement('p');
        count.className = 'mp-seat-count';
        count.setAttribute('role', 'status');
        count.textContent = `${selectedCount} player${selectedCount === 1 ? '' : 's'} selected`;
        selection.append(seatTitle, seatHint, seatList, count);
        root.append(selection);
        const gamesTitle = document.createElement('h3');
        gamesTitle.textContent = 'Choose a game';
        const scope = document.createElement('p');
        scope.textContent = `Games for ${selectedCount} selected player${selectedCount === 1 ? '' : 's'}. Change the seats above to unlock other games.`;
        games.append(gamesTitle, scope);
        const supported = catalog.filter(game => REMOTE_GAMES.has(game.id));
        supported.sort((a, b) => Number(b.id === this.preferredGame) - Number(a.id === this.preferredGame));
        const available = document.createElement('div');
        available.className = 'mp-game-list';
        const unavailable = [];
        for (const game of supported) {
          if (!GAME_ID.test(game?.id ?? '')) continue;
          const { min, max } = seatLimits(game);
          if (selectedCount < min || selectedCount > max) {
            unavailable.push(`${game.name} (${min}–${max})`);
            continue;
          }
          button(`${game.name} (${min}–${max} players)`, () => {
            const guestIds = eligibleGuests.filter(member => !draft.excludedSeats.has(member.id))
              .map(member => member.id);
            this.startGame(game.id, [this.peerId, ...guestIds]);
            onStart(game.id);
          }, available);
        }
        if (!available.children.length) {
          const empty = document.createElement('p');
          const largestGame = Math.max(0, ...supported.map(game => seatLimits(game).max));
          empty.textContent = selectedCount > largestGame
            ? `Uncheck guests to select at most ${largestGame} players for a room game.`
            : 'Select another player, or invite a guest to unlock a game.';
          available.append(empty);
        }
        games.append(available);
        if (unavailable.length) {
          const other = document.createElement('p');
          other.className = 'mp-local-only';
          other.textContent = `Change player count for: ${unavailable.join(', ')}.`;
          games.append(other);
        }
        const local = document.createElement('p');
        local.className = 'mp-local-only';
        local.textContent = 'Other cabinets are local-only.';
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
      if (event.type === 'state' && this.connectionIssue && this.activeGame && overlay.isConnected)
        overlay.hidden = false;
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
