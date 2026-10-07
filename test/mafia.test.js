import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { newMafia, actMafia, resolveMafia, viewFor, pending } from '../games/mafia-engine.js';
import { MultiplayerRoom } from '../js/multiplayer.js';

globalThis.crypto ??= webcrypto;
globalThis.location = new URL('https://example.test/arcade/index.html#/');
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });

function setup(count = 5) {
  const s = newMafia(count, () => .99);
  s.roles = count === 5
    ? ['town', 'mafia', 'doctor', 'detective', 'town']
    : ['town', 'mafia', 'doctor', 'detective', 'town', 'mafia', 'town'];
  return s;
}
const move = (s, actor, target) => actMafia(s, { type: 'mafia-act', revision: s.revision, target }, actor);
const next = s => actMafia(s, { type: 'mafia-next', revision: s.revision }, 0);
function night(s, mafiaTarget, doctorTarget, detectiveTarget) {
  s = move(s, 1, mafiaTarget);
  s = move(s, 2, doctorTarget);
  s = move(s, 3, detectiveTarget);
  return resolveMafia(s, 0);
}

test('private night protection and investigation, town victory and replay deal', () => {
  let s = setup();
  assert.deepEqual(pending(s), [1, 2, 3]);
  assert.throws(() => move(s, 0, 1), /not available/);
  s = night(s, 4, 4, 1);
  assert.equal(s.phase, 'discussion');
  assert.equal(s.alive[4], true);
  assert.equal(s.clues[3][0].mafia, true);
  assert.equal(viewFor(s, 0).clues.length, 0);
  assert.equal(JSON.stringify(viewFor(s, 0)).includes('"roles"'), false);
  assert.equal(JSON.stringify(viewFor(s, 2)).includes('"mafia":true'), false);
  assert.equal(viewFor(s, 3).clues[0].target, 1);
  s = next(s);
  for (const i of [0, 2, 3, 4]) s = move(s, i, 1);
  assert.equal(viewFor(s, 0).ownTarget, 1);
  assert.equal(viewFor(s, 2).ownTarget, 1);
  assert.equal(viewFor(s, 3).roles, undefined);
  assert.throws(() => move(s, 0, 1), /not available/);
  s = move(s, 1, 0);
  s = resolveMafia(s, 0);
  assert.equal(s.winner, 'town');
  assert.equal(s.phase, 'over');
  assert.deepEqual(viewFor(s, 4).roles, s.roles);
  assert.throws(() => move(s, 4, 1), /passed/);
  assert.equal(newMafia(5).roles.length, 5);
});

test('day tie and abstention, night losses, mafia parity, eliminated restrictions', () => {
  let s = night(setup(), 4, 2, 1);
  assert.equal(s.alive[4], false);
  assert.deepEqual(pending(s), []);
  s = next(s);
  for (const [seat, target] of [[0, 1], [1, 0], [2, null], [3, null]])
    s = move(s, seat, target);
  assert.throws(() => move(s, 4, 1), /not available/);
  s = resolveMafia(s, 0);
  assert.equal(s.alive[0], true);
  assert.equal(s.phase, 'night');
  assert.match(s.announcement, /vote tied/);
  s = night(s, 0, 2, 0);
  assert.equal(s.alive[0], false);
  s = next(s);
  s = move(s, 1, 2);
  s = move(s, 2, 3);
  s = move(s, 3, 2);
  s = resolveMafia(s, 0);
  assert.equal(s.winner, 'mafia');
});

test('stale, malformed and duplicate submissions rejected; split Mafia attack has no victim', () => {
  let s = setup(7);
  assert.throws(() => move(s, 1, 1), /not available/);
  s = move(s, 1, 0);
  assert.throws(() => actMafia(s, { type: 'mafia-act', revision: 0, target: 2 }, 5), /passed/);
  assert.throws(() => move(s, 1, 4), /not available/);
  assert.throws(() => resolveMafia(s, 0), /Wait/);
  s = move(s, 5, 4);
  s = move(s, 2, 0);
  s = move(s, 3, 1);
  s = resolveMafia(s, 0);
  assert.equal(s.alive.every(Boolean), true);
  assert.equal(viewFor(s, 1).allies[0], 5);
  assert.equal(viewFor(s, 0).allies.length, 0);
});

test('host can skip absent seat for night and vote; reconnecting seat returns next phase', () => {
  let s = setup();
  s = move(s, 1, 4);
  s = actMafia(s, { type: 'mafia-skip', revision: s.revision, target: 2 }, 0);
  s = actMafia(s, { type: 'mafia-skip', revision: s.revision, target: 3 }, 0);
  assert.deepEqual(pending(s), []);
  s = resolveMafia(s, 0);
  assert.equal(s.alive[4], false);
  s = next(s);
  s = move(s, 0, 1);
  s = move(s, 1, 0);
  s = move(s, 2, 1);
  s = actMafia(s, { type: 'mafia-skip', revision: s.revision, target: 3 }, 0);
  s = resolveMafia(s, 0);
  assert.equal(s.winner, 'town');
  assert.equal(viewFor(s, 3).skipped.length, 0);
});

class Channel {
  constructor() { this.label = 'arcade'; this.readyState = 'connecting'; }
  send(data) { this.sent = data; this.other?.onmessage?.({ data }); }
  close() { this.readyState = 'closed'; this.onclose?.(); }
}
class Peer {
  static instances = [];
  constructor() {
    this.iceGatheringState = 'complete';
    this.signalingState = 'stable';
    this.connectionState = 'new';
    Peer.instances.push(this);
  }
  createDataChannel() { return this.channel = new Channel(); }
  async createOffer() { return { type: 'offer', sdp: 'v=0\r\nfake-offer' }; }
  async createAnswer() { return { type: 'answer', sdp: 'v=0\r\nfake-answer' }; }
  async setLocalDescription(value) {
    this.localDescription = value;
    if (value.type === 'offer') this.signalingState = 'have-local-offer';
  }
  async setRemoteDescription(value) {
    this.remoteDescription = value;
    if (value.type === 'answer') this.signalingState = 'stable';
  }
  addEventListener() {}
  removeEventListener() {}
  close() { this.connectionState = 'closed'; }
}

test('real room envelopes privately route 5 seats and accept requests despite absent peer', async () => {
  globalThis.RTCPeerConnection = Peer;
  const host = new MultiplayerRoom();
  host.createHost('Host');
  const guests = Array.from({ length: 4 }, () => new MultiplayerRoom());
  const inboxes = guests.map(() => []);
  try {
    for (const [i, guest] of guests.entries()) {
      guest.on(e => { if (e.type === 'action') inboxes[i].push(e.action); });
      const answer = await guest.joinInvite(await host.createInvite(), `Guest ${i}`);
      await host.acceptAnswer(answer);
      const hp = Peer.instances.at(-2), gp = Peer.instances.at(-1);
      const ch = new Channel();
      hp.channel.other = ch; ch.other = hp.channel;
      gp.ondatachannel({ channel: ch });
      hp.channel.readyState = ch.readyState = 'open';
      hp.channel.onopen(); ch.onopen();
    }
    host.startGame('mafia', [host.peerId, ...guests.map(g => g.peerId)]);
    let s = setup();
    const received = [];
    host.on(e => { if (e.type === 'action') received.push(e); });
    host.saveGame('mafia', { state: s, round: 1 });
    guests[0].sendAction({ type: 'mafia-act', revision: s.revision, target: 4 });
    assert.equal(received.at(-1).from, guests[0].peerId);
    s = actMafia(s, received.at(-1).action, 1);
    assert.ok(!inboxes.some(list => list.length), 'guest actions never broadcast to others');
    host.sendPrivateAction(guests[2].peerId, { type: 'mafia-state', round: 1, view: viewFor(s, 3) });
    assert.equal(inboxes[2].length, 1);
    assert.ok(inboxes.every((list, i) => i === 2 || list.length === 0));
    assert.equal(JSON.stringify(inboxes[2]).includes('"target":4'), false);
    assert.equal(JSON.stringify(inboxes[2]).includes('"roles"'), false);
    host.members.find(m => m.id === guests[3].peerId).connected = false;
    guests[1].sendAction({ type: 'mafia-act', revision: s.revision, target: 4 });
    assert.equal(received.at(-1).from, guests[1].peerId);
    guests[2].sendAction({ type: 'mafia-sync' });
    assert.equal(received.at(-1).action.type, 'mafia-sync');
    assert.throws(() => actMafia(s, received.at(-2).action, 0), /not available/);
  } finally {
    guests.forEach(g => g.close());
    host.close();
  }
});
