import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { MultiplayerRoom } from '../js/multiplayer.js';

globalThis.crypto ??= webcrypto;
globalThis.location = new URL('https://example.test/arcade/index.html#/');
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });

class FakeChannel {
  constructor(label) { this.label = label; this.readyState = 'connecting'; }
  send(data) { this.sent = data; this.other?.onmessage?.({ data }); }
  close() { this.readyState = 'closed'; this.onclose?.(); }
}
class FakePeer {
  static instances = [];
  constructor(config) {
    this.config = config;
    this.iceGatheringState = 'complete';
    this.signalingState = 'stable';
    this.connectionState = 'new';
    FakePeer.instances.push(this);
  }
  createDataChannel(label, options) {
    assert.equal(options.ordered, true);
    return (this.channel = new FakeChannel(label));
  }
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
globalThis.RTCPeerConnection = FakePeer;

test('offline invite and answer require a second exchange; several sequential guests can join', async () => {
  const host = new MultiplayerRoom();
  const guest = new MultiplayerRoom();
  const events = [];
  guest.on((event) => events.push(event));
  host.createHost('Host');
  const invite = await host.createInvite();
  assert.match(invite, /invite=/);
  assert.deepEqual(FakePeer.instances.at(-1).config.iceServers, []);
  const answer = await guest.joinInvite(invite, 'Guest');
  assert.match(answer, /answer=/);
  assert.equal(host.members.length, 1);
  assert.equal(guest.members[0].connected, false);
  await host.acceptAnswer(answer);
  await assert.rejects(host.acceptAnswer(answer), /No pending invitation/);
  const hp = FakePeer.instances.at(-2);
  const gp = FakePeer.instances.at(-1);
  const guestChannel = new FakeChannel('arcade');
  hp.channel.other = guestChannel;
  guestChannel.other = hp.channel;
  gp.ondatachannel({ channel: guestChannel });
  hp.channel.readyState = guestChannel.readyState = 'open';
  hp.channel.onopen();
  guestChannel.onopen();
  assert.equal(host.members[1].connected, true);
  assert.equal(guest.members.length, 2);
  host.startGame('chess', [host.peerId, guest.peerId]);
  assert.equal(guest.activeGame.id, 'chess');
  assert.equal(guest.activeGame.seed, host.activeGame.seed, 'host seed reaches the guest unchanged');
  assert.ok(Number.isInteger(host.activeGame.seed) && host.activeGame.seed >= 0 &&
    host.activeGame.seed <= 0xffffffff);
  const selectedStarts = events.filter((event) => event.type === 'game' && event.game);
  host.startGame('chess', [host.peerId, guest.peerId]);
  assert.equal(events.filter((event) => event.type === 'game' && event.game).length,
    selectedStarts.length + 1, 'restarting the same game notifies the selected guest');
  assert.throws(() => host.startGame('chess', [guest.peerId, host.peerId]), /host first/);
  assert.throws(() => host.startGame('chess', [host.peerId]), /player count/);
  assert.throws(() => host.startGame('minesweeper', [host.peerId]), /local-only/);
  assert.throws(() => host.startGame('not-in-catalog', [host.peerId]), /local-only/);
  const actions = [];
  host.on((event) => { if (event.type === 'action') actions.push(event); });
  guest.sendAction({ type: 'move', from: 'e2', to: 'e4' });
  const firstAction = guestChannel.sent;
  assert.equal(actions.at(-1).from, guest.peerId);
  assert.equal(actions.at(-1).sequence, 1);
  assert.equal(events.at(-1).sequence, 1);
  host.sendAction({ type: 'move', from: 'e7', to: 'e5' });
  assert.equal(actions.at(-1).from, host.peerId);
  assert.equal(actions.at(-1).sequence, 2);
  assert.equal(events.at(-1).sequence, 2);
  const priorActions = actions.length;
  const errors = [];
  host.on((event) => { if (event.type === 'error') errors.push(event.message); });
  guestChannel.send(firstAction);
  assert.match(errors.at(-1), /duplicate room message/, 'replayed requests are rejected');
  assert.equal(actions.length, priorActions);
  const wrongGame = JSON.stringify({
    v: 1, room: host.roomId, id: guest.peerId, request: `${guest.peerId}:999`,
    kind: 'action', game: 'connect-four', action: { type: 'move' },
  });

  guestChannel.send(wrongGame);
  assert.equal(actions.length, priorActions, 'host rejects actions for a different active game');
  guestChannel.send(JSON.stringify({
    v: 1, room: host.roomId, id: guest.peerId, request: `${guest.peerId}:1000`,
    kind: 'action', game: 'chess', action: { type: 'move', data: 'x'.repeat(8100) },
  }));
  assert.equal(actions.length, priorActions, 'host rejects oversized action payloads');
  host.setAdmission(guest.peerId, false);
  assert.equal(host.activeGame, null);
  assert.equal(guest.activeGame, null);
  assert.throws(() => guest.sendAction({ type: 'move' }), /not playing/);
  guestChannel.send(JSON.stringify({
    v: 1, room: host.roomId, id: guest.peerId, request: `${guest.peerId}:1001`,
    kind: 'action', game: 'chess', action: { type: 'move' },
  }));
  assert.equal(actions.length, priorActions, 'unadmitted guest cannot relay actions');
  const next = await host.createInvite();
  assert.notEqual(next, invite);
  assert.equal(host.members.length, 2);
  assert.ok(events.some((event) => event.type === 'game'));
  guest.close();
  host.close();
});

test('UNO requests reach host only; private hands reach only their selected recipient', async () => {
  const host = new MultiplayerRoom();
  const guests = [new MultiplayerRoom(), new MultiplayerRoom(), new MultiplayerRoom()];
  const seen = guests.map(() => []);
  host.createHost('Host');
  for (const [index, guest] of guests.entries()) {
    guest.on(event => { if (event.type === 'action') seen[index].push(event); });
    const invite = await host.createInvite();
    const answer = await guest.joinInvite(invite, `Guest ${index + 1}`);
    await host.acceptAnswer(answer);
    const hp = FakePeer.instances.at(-2);
    const gp = FakePeer.instances.at(-1);
    const channel = new FakeChannel('arcade');
    hp.channel.other = channel;
    channel.other = hp.channel;
    gp.ondatachannel({ channel });
    hp.channel.readyState = channel.readyState = 'open';
    hp.channel.onopen();
    channel.onopen();
  }
  host.startGame('uno', [host.peerId, guests[0].peerId, guests[1].peerId]);
  let request;
  host.on(event => { if (event.type === 'action') request = event; });
  guests[0].sendAction({ type: 'uno-request', move: { type: 'draw' } });
  assert.equal(request.from, guests[0].peerId);
  assert.equal(request.action.move.type, 'draw');
  assert.deepEqual(seen.map(events => events.length), [0, 0, 0]);
  const card = { id: 5, color: 'red', value: '3' };
  host.sendPrivateAction(guests[0].peerId, {
    type: 'uno-state', revision: 1, view: { hand: [card], counts: [7, 1, 7] },
  });
  assert.deepEqual(seen.map(events => events.length), [1, 0, 0]);
  assert.deepEqual(seen[0][0].action.view.hand, [card]);
  assert.equal(host.peers.get(guests[1].peerId).channel.sent.includes('"hand"'), false);
  assert.equal(host.peers.get(guests[2].peerId).channel.sent.includes('"hand"'), false);
  assert.throws(() => host.sendPrivateAction(guests[2].peerId, { type: 'uno-state' }), /recipient/);
  guests.forEach(guest => guest.close());
  host.close();
});

test('malformed links, wrong room and oversized links are rejected', async () => {
  const host = new MultiplayerRoom();
  host.createHost('Host');
  const invite = await host.createInvite();
  const guest = new MultiplayerRoom();
  await assert.rejects(guest.joinInvite('https://evil.test/arcade/index.html?invite=x', 'Guest'), /different arcade/);
  await assert.rejects(guest.joinInvite(invite.replace('invite=', 'invite=x&invite='), 'Guest'), /exactly one/);
  await assert.rejects(guest.joinInvite('https://example.test/arcade/index.html?invite=r!!!', 'Guest'), /encoding/);
  await assert.rejects(guest.joinInvite('x'.repeat(16001), 'Guest'), /oversized/);
  const answer = await guest.joinInvite(invite, 'Guest');
  const other = new MultiplayerRoom();
  other.createHost('Other');
  await assert.rejects(other.acceptAnswer(answer), /different room/);
  host.close();
  guest.close();
  other.close();
});

test('online peer enables public STUN and share safely falls back to manual copy', async () => {
  navigator.onLine = true;
  const host = new MultiplayerRoom();
  host.createHost('Host');
  await host.createInvite();
  assert.match(FakePeer.instances.at(-1).config.iceServers[0].urls, /^stun:/);
  assert.deepEqual(await host.share('https://example.test/link'), { method: 'manual', url: 'https://example.test/link' });
  assert.throws(() => host.startGame('chess', [crypto.randomUUID()]), /admitted players/);
  host.close();
  navigator.onLine = false;
});

test('only supported catalog games can start remotely and room restart resets sequence', () => {
  const host = new MultiplayerRoom();
  host.createHost('Host');
  const guestIds = Array.from({ length: 3 }, () => crypto.randomUUID());
  host.members.push(...guestIds.map((id, index) =>
    ({ id, name: `Guest ${index + 1}`, connected: true, admitted: true })));
  for (const game of ['tictactoe', 'connect-four', 'chess', 'rps']) {
    host.startGame(game, [host.peerId, guestIds[0]]);
    assert.equal(host.activeGame.id, game);
    assert.equal(host.activeGame.playerIds.length, 2);
    assert.throws(() => host.startGame(game, [host.peerId, ...guestIds]), /player count/);
  }
  for (const game of ['snakes-ladders', 'ludo', 'uno']) {
    for (const count of [2, 3, 4]) {
      host.startGame(game, [host.peerId, ...guestIds.slice(0, count - 1)]);
      assert.equal(host.activeGame.playerIds.length, count);
      assert.equal(host.activeGame.playerIds[0], host.peerId);
    }
    assert.throws(() => host.startGame(game, [host.peerId]), /player count/);
  }
  for (const game of ['minesweeper', 'blackjack']) {
    assert.throws(() => host.startGame(game, [host.peerId]), /local-only/);
  }
  host.startGame('ludo', [host.peerId, guestIds[0]]);
  host.sendAction({ type: 'move' });
  assert.equal(host.actionSequence, 1);
  host.close();
  host.createHost('Second host');
  assert.equal(host.actionSequence, 0);
  host.close();
});

test('only selected guests receive game-start events; observers remain in the lobby', async () => {
  const host = new MultiplayerRoom();
  const guests = [new MultiplayerRoom(), new MultiplayerRoom(), new MultiplayerRoom()];
  const events = guests.map(() => []);
  host.createHost('Host');
  for (const [index, guest] of guests.entries()) {
    guest.on((event) => events[index].push(event));
    const invite = await host.createInvite();
    const answer = await guest.joinInvite(invite, `Guest ${index + 1}`);
    await host.acceptAnswer(answer);
    const hp = FakePeer.instances.at(-2);
    const gp = FakePeer.instances.at(-1);
    const guestChannel = new FakeChannel('arcade');
    hp.channel.other = guestChannel;
    guestChannel.other = hp.channel;
    gp.ondatachannel({ channel: guestChannel });
    hp.channel.readyState = guestChannel.readyState = 'open';
    hp.channel.onopen();
    guestChannel.onopen();
  }
  const hostGames = [];
  host.on((event) => { if (event.type === 'game') hostGames.push(event); });
  host.startGame('tictactoe', [host.peerId, guests[0].peerId]);
  assert.equal(hostGames.at(-1).game.playerIds[0], host.peerId);
  assert.equal(events[0].filter((event) => event.type === 'game' && event.game).length, 1);
  assert.equal(events[1].filter((event) => event.type === 'game' && event.game).length, 0);
  assert.equal(events[2].filter((event) => event.type === 'game' && event.game).length, 0);
  assert.equal(guests[1].activeGame.id, 'tictactoe', 'spectator sees room state, not a start event');
  host.startGame('chess', [host.peerId, guests[1].peerId]);
  assert.equal(events[0].at(-1).game, null, 'former player returns to lobby');
  assert.equal(events[1].at(-1).game.id, 'chess');
  host.startGame('ludo', [host.peerId, ...guests.map((guest) => guest.peerId)]);
  for (const [index, guest] of guests.entries()) {
    assert.equal(guest.activeGame.seed, host.activeGame.seed);
    assert.equal(events[index].at(-1).game.seed, host.activeGame.seed);
    assert.deepEqual(guest.activeGame.playerIds, host.activeGame.playerIds);
  }
  host.startGame('snakes-ladders', [host.peerId, guests[1].peerId, guests[2].peerId]);
  assert.equal(events[0].at(-1).game, null);
  assert.equal(events[1].at(-1).game.seed, host.activeGame.seed);
  assert.equal(events[2].at(-1).game.seed, host.activeGame.seed);
  guests.forEach((guest) => guest.close());
  host.close();
});

test('raw fallback remains readable and malformed compressed payloads fail safely', async () => {
  const compression = globalThis.CompressionStream;
  const decompression = globalThis.DecompressionStream;
  const host = new MultiplayerRoom();
  const guest = new MultiplayerRoom();
  try {
    globalThis.CompressionStream = undefined;
    host.createHost('HøST');
    const invite = await host.createInvite();
    assert.match(new URL(invite).searchParams.get('invite'), /^r/);
    globalThis.DecompressionStream = undefined;
    const answer = await guest.joinInvite(invite, 'Güest');
    await host.acceptAnswer(answer);
    assert.equal(host.members[1].name, 'Güest');
    const broken = new URL(invite);
    broken.searchParams.set('invite', 'zYWJj');
    await assert.rejects(new MultiplayerRoom().joinInvite(broken.href, 'Test'), /cannot read compressed/);
  } finally {
    host.close();
    guest.close();
    globalThis.CompressionStream = compression;
    globalThis.DecompressionStream = decompression;
  }
});

async function connectGuest(host, name) {
  const guest = new MultiplayerRoom();
  const answer = await guest.joinInvite(await host.createInvite(), name);
  await host.acceptAnswer(answer);
  const hp = FakePeer.instances.at(-2);
  const gp = FakePeer.instances.at(-1);
  const channel = new FakeChannel('arcade');
  hp.channel.other = channel;
  channel.other = hp.channel;
  gp.ondatachannel({ channel });
  hp.channel.readyState = channel.readyState = 'open';
  hp.channel.onopen();
  channel.onopen();
  return { guest, hostChannel: hp.channel, guestChannel: channel };
}

test('host records each round once, retains results across games, and resets on a new room', () => {
  const host = new MultiplayerRoom();
  host.createHost('Host');
  const guestId = crypto.randomUUID();
  host.members.push({ id: guestId, name: 'Guest', connected: true, admitted: true });
  assert.throws(() => host.recordResult('chess', 0, 'one'), /active game/);
  host.startGame('chess', [host.peerId, guestId]);
  for (const [game, winner, key, error] of [
    ['rps', 0, 'one', /active game/], ['chess', 2, 'one', /Winner/],
    ['chess', -1, 'one', /Winner/], ['chess', 0.5, 'one', /Winner/],
    ['chess', undefined, 'one', /Winner/], ['chess', 0, '', /Round key/],
    ['chess', 0, {}, /Round key/], ['chess', 0, -1, /Round key/],
    ['chess', 0, Number.MAX_SAFE_INTEGER + 1, /Round key/],
  ]) assert.throws(() => host.recordResult(game, winner, key), error);
  assert.equal(host.recordResult('chess', 0, 'one'), true);
  assert.equal(host.recordResult('chess', 1, 'one'), false, 'retry cannot change the winner');
  assert.equal(host.recordResult('chess', null, 1), true);
  assert.equal(host.recordResult('chess', 1, '1'), true, 'string and integer keys differ');
  assert.deepEqual(host.stats.games, [{ id: 'chess', wins: 2, losses: 2, draws: 2 }]);
  host.returnLobby();
  assert.throws(() => host.recordResult('chess', 0, 'one'), /active game/);
  host.startGame('chess', [host.peerId, guestId]);
  assert.equal(host.recordResult('chess', 1, 'one'), true, 'new game generation reuses local key');
  host.startGame('rps', [host.peerId, guestId]);
  assert.equal(host.recordResult('rps', null, 'one'), true);
  assert.deepEqual(host.stats.games, [
    { id: 'chess', wins: 3, losses: 3, draws: 2 },
    { id: 'rps', wins: 0, losses: 0, draws: 2 },
  ]);
  host.close();
  assert.deepEqual(host.stats, { games: [], players: [] });
  host.createHost('New host');
  assert.deepEqual(host.stats, { games: [], players: [] });
  host.close();
});

test('standings sync to guests, reject forged and malformed state, and keep disconnected names', async () => {
  const host = new MultiplayerRoom();
  host.createHost('Captain');
  const { guest, hostChannel, guestChannel } = await connectGuest(host, 'Zed');
  const errors = [];
  host.on((event) => { if (event.type === 'error') errors.push(event.message); });
  guest.on((event) => { if (event.type === 'error') errors.push(event.message); });
  host.startGame('chess', [host.peerId, guest.peerId]);
  assert.throws(() => guest.recordResult('chess', 1, 'g1'), /Only the host/);
  guestChannel.send(JSON.stringify({
    v: 1, room: host.roomId, id: guest.peerId, request: `${guest.peerId}:100`,
    kind: 'result', game: 'chess', winnerIndex: 1, roundKey: 'g1',
  }));
  assert.match(errors.at(-1), /Guests cannot change room state/);
  assert.deepEqual(host.stats.players, []);
  host.recordResult('chess', 1, 'g1');
  assert.deepEqual(guest.stats, host.stats);
  assert.equal(guest.leaderboard()[0].name, 'Zed');
  const late = await connectGuest(host, 'Late guest');
  assert.deepEqual(late.guest.stats, host.stats, 'late joiners receive prior results');
  const before = structuredClone(guest.stats);
  const valid = JSON.parse(hostChannel.sent);
  const broken = [
    { ...valid, stats: { games: [], players: [{ id: guest.peerId, wins: 1, losses: 0, draws: 0, games: [] }] } },
    { ...valid, stats: { games: [{ id: '__proto__', wins: 1, losses: 0, draws: 0 }], players: [] } },
    { ...valid, stats: { games: [{ id: 'chess', wins: -1, losses: 1, draws: 0 }], players: [] } },
    { ...valid, stats: { games: [], players: [{ id: crypto.randomUUID(), wins: 0, losses: 0, draws: 0, games: [] }] } },
    { ...valid, stats: null },
  ];
  const guestPeer = guest.peers.get(host.peerId);
  for (const [index, state] of broken.entries()) {
    state.request = `${host.peerId}:${guestPeer.lastRequest + index + 1}`;
    guest.receive(guestPeer, host.peerId, JSON.stringify(state));
    assert.match(errors.at(-1), /Invalid room standings/);
    assert.deepEqual(guest.stats, before);
  }
  hostChannel.close();
  assert.equal(host.members.find((member) => member.id === guest.peerId).connected, false);
  assert.equal(host.leaderboard()[0].name, 'Zed');
  assert.equal(host.leaderboard()[0].connected, false);
  guest.close();
  assert.deepEqual(guest.stats, { games: [], players: [] });
  const otherHost = new MultiplayerRoom();
  otherHost.createHost('Another host');
  await late.guest.joinInvite(await otherHost.createInvite(), 'Late guest');
  assert.deepEqual(late.guest.stats, { games: [], players: [] }, 'joining a new room discards prior results');
  late.guest.close();
  otherHost.close();
  host.close();
});

test('leaderboard orders ties by losses, draws, name then peer ID; lobby renders standings', () => {
  const host = new MultiplayerRoom();
  host.createHost('Zed');
  const names = ['Amy', 'Bob', 'Bob'];
  const ids = names.map(() => crypto.randomUUID());
  host.members.push(...ids.map((id, index) =>
    ({ id, name: names[index], connected: true, admitted: true })));
  host.startGame('ludo', [host.peerId, ...ids]);
  host.recordResult('ludo', null, 'draw');
  host.recordResult('ludo', 1, 'win');
  assert.deepEqual(host.leaderboard().map((entry) => entry.name), ['Amy', 'Bob', 'Bob', 'Zed']);
  // Identical name and score ties resolve deterministically by peer ID.
  const tied = host.leaderboard().filter((entry) => entry.name === 'Bob');
  assert.deepEqual(tied.map((entry) => entry.id), [...tied.map((entry) => entry.id)].sort());
  const previousDocument = globalThis.document;
  const previousElement = globalThis.Element;
  class ElementStub {
    constructor(tag = 'div') { this.tag = tag; this.children = []; this.attributes = {}; this.textContent = ''; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = [...nodes]; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener() {}
    querySelectorAll() { return []; }
    querySelector() { return null; }
  }
  const text = (node) => node?.textContent + (node?.children ?? []).map(text).join('');
  try {
    globalThis.Element = ElementStub;
    globalThis.document = {
      createElement: (tag) => new ElementStub(tag),
      createTextNode: (value) => new ElementStub(value),
    };
    const container = new ElementStub();
    const unmount = host.mountLobby(container, [{ id: 'ludo', name: 'Ludo', players: { min: 2, max: 4 } }], () => {});
    assert.match(text(container), /Room standings/);
    assert.match(text(container), /Amy · 1 W \/ 0 L \/ 1 D/);
    assert.match(text(container), /Ludo: 1 W \/ 3 L \/ 4 D/);
    assert.match(text(container), /Bob: 0 W \/ 1 L \/ 1 D/);
    unmount();
    const guest = new MultiplayerRoom();
    guest.role = 'guest';
    guest.peerId = ids[0];
    guest.members = structuredClone(host.members);
    guest.stats = structuredClone(host.stats);
    guest.activeGame = structuredClone(host.activeGame);
    const guestContainer = new ElementStub();
    const unmountGuest = guest.mountLobby(guestContainer, [{ id: 'ludo', name: 'Ludo' }], () => {});
    assert.match(text(guestContainer), /Room standings/);
    assert.match(text(guestContainer), /Amy · 1 W \/ 0 L \/ 1 D/);
    unmountGuest();
    guest.close();
  } finally {
    globalThis.document = previousDocument;
    globalThis.Element = previousElement;
    host.close();
  }
});

test('leaderboard prioritizes wins, then fewer losses, then more draws', () => {
  const room = new MultiplayerRoom();
  room.createHost('One');
  const ids = Array.from({ length: 3 }, () => crypto.randomUUID());
  room.members.push(...ids.map((id, index) => ({
    id, name: ['Two', 'Three', 'Four'][index], connected: true, admitted: true,
  })));
  room.stats.players = [
    { id: room.peerId, wins: 2, losses: 9, draws: 0, games: [] },
    { id: ids[0], wins: 1, losses: 2, draws: 1, games: [] },
    { id: ids[1], wins: 1, losses: 1, draws: 0, games: [] },
    { id: ids[2], wins: 1, losses: 1, draws: 2, games: [] },
  ];
  assert.deepEqual(room.leaderboard().map(({ name, rank }) => [name, rank]),
    [['One', 1], ['Four', 2], ['Three', 3], ['Two', 4]]);
  room.close();
});
