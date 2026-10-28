import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Room,
  readSignal,
  validSnapshot,
} from '../../src/lib/room/protocol.ts';

const cache = new Map<string, string>();
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => cache.get(k) ?? null,
    setItem: (k: string, v: string) => cache.set(k, v),
    removeItem: (k: string) => cache.delete(k),
  },
});
class Channel {
  label = 'arcade-redesign';
  readyState = 'connecting';
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  other: Channel | null = null;
  send(data: string) {
    queueMicrotask(() => this.other?.onmessage?.({ data }));
  }
  close() {
    this.readyState = 'closed';
    if (this.other) {
      this.other.readyState = 'closed';
      this.other.onclose?.();
    }
  }
}
class Peer {
  static peers: Peer[] = [];
  id = Peer.peers.push(this) - 1;
  iceGatheringState = 'complete';
  connectionState = 'connected';
  localDescription: {
    type: string;
    sdp: string;
    toJSON: () => { type: string; sdp: string };
  } | null = null;
  ondatachannel: ((e: { channel: Channel }) => void) | null = null;
  channel: Channel | null = null;
  createDataChannel() {
    return (this.channel = new Channel());
  }
  async createOffer() {
    return { type: 'offer', sdp: `v=0\nid=${this.id}` };
  }
  async createAnswer() {
    return { type: 'answer', sdp: `v=0\nid=${this.id}` };
  }
  async setLocalDescription(s: { type: string; sdp: string }) {
    this.localDescription = { ...s, toJSON: () => s };
  }
  async setRemoteDescription(s: { type: string; sdp: string }) {
    if (s.type !== 'answer') return;
    const guest = Peer.peers[Number(s.sdp.split('=')[2])];
    const hostChannel = this.channel!;
    const guestChannel = new Channel();
    guest.channel = guestChannel;
    hostChannel.other = guestChannel;
    guestChannel.other = hostChannel;
    guest.ondatachannel?.({ channel: guestChannel });
    queueMicrotask(() => {
      hostChannel.readyState = guestChannel.readyState = 'open';
      hostChannel.onopen?.();
      guestChannel.onopen?.();
    });
  }
  close() {
    this.connectionState = 'closed';
    this.channel?.close();
  }
}
const factory = () => new Peer() as unknown as RTCPeerConnection;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
async function connect(host: Room, guest: Room) {
  const offer = await host.createInvite();
  const answer = await guest.joinInvite(offer, 'Kai');
  await host.acceptAnswer(answer);
  await flush();
}

test('full admission, host authority, result, rematch, reload and same-seat reconnect', async () => {
  cache.clear();
  const host = new Room(factory);
  const guest = new Room(factory);
  host.createHost('Mira');
  await connect(host, guest);
  assert.ok(host.snapshot?.members.every((m) => m.connected));
  assert.deepEqual(guest.snapshot, host.snapshot);
  host.start();
  await flush();
  guest.move(4);
  await flush();
  assert.equal(host.snapshot?.match?.revision, 0, 'wrong seat rejected');
  host.move(8);
  await flush();
  const wire = Peer.peers.at(-1)!.channel!;
  const send = wire.send;
  wire.send = function (data: string) {
    const m = JSON.parse(data);
    if (m.type === 'move') m.revision = -1;
    send.call(this, JSON.stringify(m));
  };
  guest.move(0);
  await flush();
  assert.equal(host.snapshot?.match?.revision, 1, 'stale revision rejected');
  wire.send = send;
  // Start a clean round for the deterministic winning line below.
  host.start();
  await flush();
  for (const [player, cell] of [
    [host, 0],
    [guest, 3],
    [host, 1],
    [guest, 4],
    [host, 2],
  ] as const) {
    player.move(cell);
    await flush();
  }
  assert.equal(host.snapshot?.match?.over, true);
  assert.deepEqual(host.snapshot?.wins, [1, 0]);
  guest.move(8);
  await flush();
  assert.deepEqual(host.snapshot?.wins, [1, 0]);
  assert.deepEqual(guest.snapshot, host.snapshot);
  assert.throws(() => guest.start(), /Wait/);
  host.start();
  await flush();
  assert.equal(guest.snapshot?.match?.round, 2);
  host.move(4);
  await flush();
  const guestId = guest.peerId;
  const restored = new Room(factory);
  restored.restore();
  assert.equal(restored.role, 'host');
  assert.equal(restored.snapshot?.members[1].connected, false);
  host.leave();
  await connect(restored, guest);
  assert.equal(guest.peerId, guestId);
  assert.equal(guest.snapshot?.match?.board[4], 1);
  guest.move(0);
  await flush();
  assert.equal(restored.snapshot?.match?.board[0], 2);
  host.leave();
  restored.leave();
  guest.leave();
});

test('links reject wrong kind, malformed input, duplicated params and unrelated answers', async () => {
  const host = new Room(factory);
  const other = new Room(factory);
  const guest = new Room(factory);
  host.createHost('Mira');
  const offer = await host.createInvite();
  assert.equal(readSignal(offer, 'offer').kind, 'offer');
  assert.throws(() => readSignal(offer, 'answer'), /Invalid/);
  assert.throws(() => readSignal('javascript:alert(1)', 'offer'), /Invalid/);
  assert.throws(
    () => readSignal(`${offer}&invite=duplicate`, 'offer'),
    /Invalid/,
  );
  other.createHost('Other');
  await other.createInvite();
  const answer = await guest.joinInvite(offer, 'Kai');
  await assert.rejects(other.acceptAnswer(answer), /does not match/);
  host.leave();
  other.leave();
  guest.leave();
});

test('snapshot boundary rejects corrupt and impossible host backups', () => {
  cache.clear();
  assert.equal(validSnapshot({}), false);
  const host = new Room(factory);
  host.createHost('Mira');
  const saved = structuredClone(host.snapshot)!;
  saved.wins = [-1, 0];
  assert.equal(validSnapshot(saved), false);
  host.leave();
});

test('draw standings are counted once and reconnect name mismatch preserves the game', async () => {
  cache.clear();
  const host = new Room(factory);
  const guest = new Room(factory);
  host.createHost('Mira');
  await connect(host, guest);
  host.start();
  await flush();
  const cells = [0, 1, 2, 4, 3, 5, 7, 6, 8];
  for (let turn = 0; turn < cells.length; turn++) {
    (turn % 2 ? guest : host).move(cells[turn]);
    await flush();
  }
  assert.equal(host.snapshot?.draws, 1);
  assert.deepEqual(host.snapshot?.wins, [0, 0]);
  guest.move(0);
  await flush();
  assert.equal(host.snapshot?.draws, 1);
  host.start();
  host.move(4);
  await flush();
  const answer = await guest.joinInvite(
    await host.createInvite(),
    'Different name',
  );
  await assert.rejects(host.acceptAnswer(answer), /same room name/);
  assert.equal(host.snapshot?.members[1].name, 'Kai');
  assert.equal(host.snapshot?.match?.board[4], 1);
  host.leave();
  guest.leave();
});

test('Connect Four room uses authoritative gravity and restores the correct game after reconnect', async () => {
  cache.clear();
  const host = new Room(factory);
  const guest = new Room(factory);
  host.createHost('Mira');
  await connect(host, guest);
  host.start('connect-four');
  await flush();
  assert.equal(guest.snapshot?.match?.gameId, 'connect-four');
  assert.equal(guest.snapshot?.match?.board.length, 42);
  for (const [player, col] of [
    [host, 0],
    [guest, 1],
    [host, 0],
    [guest, 1],
    [host, 0],
    [guest, 1],
    [host, 0],
  ] as const) {
    player.move(col);
    await flush();
  }
  assert.equal(guest.snapshot?.match?.over, true);
  assert.deepEqual(guest.snapshot?.wins, [1, 0]);
  const restored = new Room(factory);
  restored.restore();
  assert.equal(restored.snapshot?.match?.gameId, 'connect-four');
  assert.equal(restored.snapshot?.match?.board[14], 1);
  restored.leave();
  host.leave();
  guest.leave();
});

test('private Crazy Eights snapshots contain only own cards, reject forged intentions, finish once and restore a private deck', async () => {
  cache.clear();
  const host = new Room(factory),
    guest = new Room(factory);
  host.createHost('Mira');
  await connect(host, guest);
  host.start('crazy-eights');
  await flush();
  const first = guest.snapshot!.cardMatch!;
  assert.equal(first.view.seat, 1);
  assert.equal(first.view.hand.length, 7);
  assert.equal(validSnapshot({ ...guest.snapshot, privateGame: {} }), false);
  assert.equal(
    validSnapshot({
      ...guest.snapshot,
      cardMatch: { ...first, view: { ...first.view, stock: [] } },
    }),
    false,
  );
  const rev = host.snapshot!.cardMatch!.revision;
  guest.cardAction({ type: 'draw' });
  await flush();
  assert.equal(host.snapshot!.cardMatch!.revision, rev, 'out-of-turn rejected');
  host.cardAction({ type: 'draw', hands: [] });
  await flush();
  assert.equal(
    host.snapshot!.cardMatch!.revision,
    rev,
    'injected fields rejected',
  );
  const wire = Peer.peers.at(-1)!.channel!,
    send = wire.send;
  wire.send = function (data: string) {
    const m = JSON.parse(data);
    if (m.type === 'card-action') m.round = -1;
    send.call(this, JSON.stringify(m));
  };
  guest.cardAction({ type: 'pass' });
  await flush();
  assert.equal(host.snapshot!.cardMatch!.revision, rev);
  wire.send = send;
  for (
    let turn = 0;
    turn < 4000 && host.snapshot!.cardMatch!.view.phase !== 'over';
    turn++
  ) {
    const actor = host.snapshot!.cardMatch!.view.current,
      player = actor === 0 ? host : guest,
      v = player.snapshot!.cardMatch!.view;
    assert.equal(v.seat, actor);
    assert.equal('hands' in v, false);
    assert.equal('stock' in v, false);
    player.cardAction(
      v.phase === 'choose'
        ? { type: 'choose', suit: '♠' }
        : v.legal.length
          ? { type: 'play', id: v.legal[0] }
          : v.canDraw && !v.drawn
            ? { type: 'draw' }
            : { type: 'pass' },
    );
    await flush();
  }
  assert.equal(host.snapshot!.cardMatch!.view.phase, 'over');
  assert.equal(
    host.snapshot!.wins.reduce((a, b) => a + b, 0) + host.snapshot!.draws,
    1,
  );
  host.cardAction({ type: 'draw' });
  assert.equal(
    host.snapshot!.wins.reduce((a, b) => a + b, 0) + host.snapshot!.draws,
    1,
  );
  host.start();
  await flush();
  host.cardAction({ type: 'draw' });
  await flush();
  const expected = structuredClone(host.snapshot!.cardMatch);
  const restored = new Room(factory);
  restored.restore();
  assert.deepEqual(restored.snapshot!.cardMatch, expected);
  host.leave();
  await connect(restored, guest);
  assert.equal(guest.snapshot!.cardMatch!.view.seat, 1);
  assert.equal(guest.snapshot!.cardMatch!.revision, expected!.revision);
  assert.ok(guest.snapshot!.members.every((m) => m.connected));
  restored.leave();
  guest.leave();
});

test('20-seat UNO admission keeps existing channels, projects every private hand and reconnects a chosen seat', async () => {
  cache.clear();
  const host = new Room(factory);
  host.createHost('Mira');
  const players = [host];
  for (let seat = 1; seat < 20; seat++) {
    const guest = new Room(factory),
      invite = await host.createInvite(),
      answer = await guest.joinInvite(invite, `Guest ${seat}`);
    await host.acceptAnswer(answer);
    await flush();
    players.push(guest);
    assert.ok(host.snapshot!.members.every((m) => m.connected));
  }
  assert.equal(host.snapshot!.members.length, 20);
  await assert.rejects(host.createInvite(), /20 players/);
  assert.throws(() => host.start('crazy-eights'), /number of players/);
  host.start('uno');
  await flush();
  const all = players.map((player, seat) => {
    const s = player.snapshot!;
    assert.ok(validSnapshot(s));
    assert.equal(s.cardMatch!.view.seat, seat);
    assert.equal(s.cardMatch!.view.counts.length, 20);
    assert.equal(s.cardMatch!.view.stockCount, 75);
    return s.cardMatch!.view.hand;
  });
  assert.equal(new Set(all.flat()).size, 140);
  for (let seat = 1; seat < 20; seat++)
    assert.ok(all[seat].every((id) => !all[0].includes(id)));
  const id = host.snapshot!.members[7].id;
  const answer = await players[7].joinInvite(
    await host.createInvite(id),
    'Guest 7',
  );
  await host.acceptAnswer(answer);
  await flush();
  assert.ok(host.snapshot!.members.every((m) => m.connected));
  assert.deepEqual(players[7].snapshot!.cardMatch!.view.hand, all[7]);
  const old = host.snapshot!.cardMatch!.revision;
  players[7].cardAction({ type: 'draw' });
  await flush();
  assert.equal(host.snapshot!.cardMatch!.revision, old);
  for (const player of players) player.leave();
});

test('v1 public host checkpoints migrate into v4 invitations without accepting old peers or extra private fields', async () => {
  cache.clear();
  const host = new Room(factory),
    guest = new Room(factory);
  host.createHost('Mira');
  await connect(host, guest);
  host.start();
  host.move(4);
  await flush();
  const saved = structuredClone(host.snapshot)!;
  host.leave();
  guest.leave();
  cache.set('arcade:redesign:room:v1', JSON.stringify(saved));
  const restored = new Room(factory);
  restored.restore();
  assert.deepEqual(restored.snapshot!.match, saved.match);
  const invite = await restored.createInvite();
  assert.equal(readSignal(invite, 'offer').version, 4);
  const url = new URL(invite),
    params = new URLSearchParams(url.hash.split('?')[1]),
    message = JSON.parse(atob(params.get('invite')!));
  message.version = 1;
  url.hash = `/room?invite=${encodeURIComponent(btoa(JSON.stringify(message)))}`;
  assert.throws(
    () => readSignal(url.href, 'offer'),
    /same version.*fresh link/,
  );
  assert.equal(
    validSnapshot({
      ...saved,
      members: saved.members.map((m) => ({ ...m, hand: [] })),
    }),
    false,
  );
  assert.equal(
    validSnapshot({ ...saved, match: { ...saved.match, stock: [] } }),
    false,
  );
  restored.leave();
});

test('four-seat race validates actions, propagates turns, and restores a paused host room', async () => {
  cache.clear();
  const host = new Room(factory);
  const guests = [new Room(factory), new Room(factory), new Room(factory)];
  host.createHost('Mira');
  for (const guest of guests) await connect(host, guest);
  host.start('ludo');
  await flush();
  assert.equal(host.snapshot?.raceMatch?.race.state.current, 0);
  assert.equal(host.snapshot?.raceMatch?.revision, 0);
  guests[0].raceAction({ type: 'roll' });
  host.raceAction({ type: 'roll', value: 6 });
  await flush();
  assert.equal(host.snapshot?.raceMatch?.revision, 0);
  host.raceAction({ type: 'roll' });
  await flush();
  assert.equal(host.snapshot?.raceMatch?.revision, 1);
  for (const guest of guests) assert.deepEqual(guest.snapshot, host.snapshot);
  const saved = structuredClone(host.snapshot!);
  assert.ok(validSnapshot(saved));
  (saved.raceMatch!.race.state as unknown as Record<string, unknown>).forged =
    3;
  assert.equal(validSnapshot(saved), false);
  const restored = new Room(factory);
  restored.restore();
  assert.equal(restored.snapshot?.raceMatch?.revision, 1);
  assert.ok(restored.snapshot?.members.slice(1).every((m) => !m.connected));
  host.leave();
  for (const guest of guests) await connect(restored, guest);
  assert.ok(restored.snapshot?.members.every((m) => m.connected));
  for (const guest of guests)
    assert.deepEqual(guest.snapshot, restored.snapshot);
  restored.start('snakes-ladders');
  await flush();
  assert.equal(restored.snapshot?.raceMatch?.gameId, 'snakes-ladders');
  assert.equal(restored.snapshot?.raceMatch?.round, 1);
  for (const guest of guests)
    assert.deepEqual(guest.snapshot, restored.snapshot);
  restored.leave();
  for (const guest of guests) guest.leave();
});

test('v2 private-card host backups restore into v4 without exposing another hand', async () => {
  cache.clear();
  const host = new Room(factory),
    guest = new Room(factory);
  host.createHost('Mira');
  await connect(host, guest);
  host.start('crazy-eights');
  await flush();
  const old = cache.get('arcade:redesign:room:v4')!;
  cache.set('arcade:redesign:room:v2', old);
  cache.delete('arcade:redesign:room:v4');
  const restored = new Room(factory);
  restored.restore();
  assert.equal(restored.role, 'host');
  assert.deepEqual(restored.snapshot?.cardMatch, host.snapshot?.cardMatch);
  host.leave();
  await connect(restored, guest);
  assert.equal(guest.snapshot?.cardMatch?.view.seat, 1);
  assert.equal('hands' in guest.snapshot!.cardMatch!.view, false);
  restored.leave();
  guest.leave();
});

test('RPS accepts crossed secret throws, hides picks, restores and records a match once', async () => {
  cache.clear();
  const host = new Room(factory),
    guest = new Room(factory);
  host.createHost('Mira');
  await connect(host, guest);
  host.start('rps');
  await flush();
  host.rpsAction({ type: 'pick', choice: 'rock' });
  guest.rpsAction({ type: 'pick', choice: 'scissors' });
  await flush();
  assert.equal(host.snapshot!.rpsMatch!.view.phase, 'countdown');
  assert.equal(guest.snapshot!.rpsMatch!.view.ownPick, 'scissors');
  assert.equal(guest.snapshot!.rpsMatch!.view.revealed, null);
  assert.equal('picks' in guest.snapshot!.rpsMatch!.view, false);
  assert.ok(validSnapshot(guest.snapshot));
  const restored = new Room(factory);
  restored.restore();
  assert.equal(restored.snapshot?.rpsMatch?.view.ownPick, 'rock');
  host.leave();
  await connect(restored, guest);
  // Advance the authoritative deadline without waiting for real animation time.
  for (let turn = 0; turn < 3; turn++) {
    if (turn) {
      restored.rpsAction({ type: 'next' });
      await flush();
      guest.rpsAction({ type: 'pick', choice: 'scissors' });
      await flush();
      restored.rpsAction({ type: 'pick', choice: 'rock' });
      await flush();
    }
    const authority = restored as unknown as {
      privateRps: { deadline: number };
      scheduleRps(): void;
    };
    authority.privateRps.deadline = 1;
    authority.scheduleRps();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await flush();
    assert.deepEqual(guest.snapshot!.rpsMatch!.view.revealed, [
      'rock',
      'scissors',
    ]);
    assert.equal(restored.snapshot!.rpsMatch!.view.score[0], turn + 1);
  }
  assert.equal(restored.snapshot!.wins[0], 1);
  restored.rpsAction({ type: 'next' });
  restored.rpsAction({ type: 'pick', choice: 'paper' });
  await flush();
  assert.equal(restored.snapshot!.wins[0], 1);
  restored.start();
  await flush();
  assert.equal(guest.snapshot!.rpsMatch!.round, 1);
  assert.deepEqual(guest.snapshot!.rpsMatch!.view.score, [0, 0]);
  restored.leave();
  guest.leave();
});

test('Chess room enforces seats, restores, completes checkmate and records one result', async () => {
  cache.clear();
  const host = new Room(factory),
    guest = new Room(factory);
  host.createHost('Mira');
  await connect(host, guest);
  host.start('chess');
  await flush();
  guest.chessAction({ type: 'move', from: 12, to: 28 });
  await flush();
  assert.equal(host.snapshot!.chessMatch!.revision, 0);
  host.chessAction({ type: 'move', from: 13, to: 21 });
  await flush();
  const restored = new Room(factory);
  restored.restore();
  assert.deepEqual(restored.snapshot!.chessMatch, host.snapshot!.chessMatch);
  host.leave();
  await connect(restored, guest);
  guest.chessAction({ type: 'move', from: 52, to: 36 });
  await flush();
  restored.chessAction({ type: 'move', from: 14, to: 30 });
  await flush();
  guest.chessAction({ type: 'move', from: 59, to: 31 });
  await flush();
  assert.ok(validSnapshot(guest.snapshot));
  assert.equal(guest.snapshot!.chessMatch!.game.over, true);
  assert.equal(restored.snapshot!.wins[1], 1);
  guest.chessAction({ type: 'move', from: 31, to: 39 });
  await flush();
  assert.equal(restored.snapshot!.wins[1], 1);
  restored.start();
  await flush();
  assert.equal(guest.snapshot!.chessMatch!.round, 1);
  assert.equal(guest.snapshot!.chessMatch!.game.over, false);
  restored.leave();
  guest.leave();
});

test('v3 race host backup restores into v4 with a fresh invitation', async () => {
  cache.clear();
  const host = new Room(factory),
    guest = new Room(factory);
  host.createHost('Mira');
  await connect(host, guest);
  host.start('ludo');
  await flush();
  const saved = cache.get('arcade:redesign:room:v4')!;
  host.leave();
  cache.set('arcade:redesign:room:v3', saved);
  const restored = new Room(factory);
  restored.restore();
  assert.equal(restored.snapshot?.raceMatch?.gameId, 'ludo');
  assert.equal(readSignal(await restored.createInvite(), 'offer').version, 4);
  restored.leave();
  guest.leave();
});
