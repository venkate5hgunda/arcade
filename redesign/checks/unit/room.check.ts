import test from 'node:test';
import assert from 'node:assert/strict';
import { actBusiness, publicBusiness } from '../../src/lib/business-core.js';
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
  assert.equal(
    host.snapshot!.standings!.players.find((p) => p.id === host.peerId)!.games
      .tictactoe!.wins,
    1,
  );
  assert.equal(
    host.snapshot!.standings!.players.find((p) => p.id === guest.peerId)!.games
      .tictactoe!.losses,
    1,
  );
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
  assert.ok(
    host.snapshot!.standings!.players.every(
      (p) => p.games.tictactoe!.draws === 1,
    ),
  );
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

test('v1 public host checkpoints migrate into v9 invitations without accepting old peers or extra private fields', async () => {
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
  assert.equal(readSignal(invite, 'offer').version, 9);
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

test('v2 private-card host backups restore into v9 without exposing another hand', async () => {
  cache.clear();
  const host = new Room(factory),
    guest = new Room(factory);
  host.createHost('Mira');
  await connect(host, guest);
  host.start('crazy-eights');
  await flush();
  const old = cache.get('arcade:redesign:room:v9')!;
  cache.set('arcade:redesign:room:v2', old);
  cache.delete('arcade:redesign:room:v9');
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

test('v3 race host backup restores into v9 with a fresh invitation', async () => {
  cache.clear();
  const host = new Room(factory),
    guest = new Room(factory);
  host.createHost('Mira');
  await connect(host, guest);
  host.start('ludo');
  await flush();
  const saved = cache.get('arcade:redesign:room:v9')!;
  host.leave();
  cache.set('arcade:redesign:room:v3', saved);
  const restored = new Room(factory);
  restored.restore();
  assert.equal(restored.snapshot?.raceMatch?.gameId, 'ludo');
  assert.equal(readSignal(await restored.createInvite(), 'offer').version, 9);
  restored.leave();
  guest.leave();
});

test('Mafia keeps roles and votes private, recovers host state and records a complete town win', async () => {
  cache.clear();
  const host = new Room(factory);
  host.createHost('Mira');
  const players = [host];
  for (let i = 1; i < 5; i++) {
    const guest = new Room(factory);
    await connect(host, guest);
    players.push(guest);
  }
  host.start('mafia');
  await flush();
  for (let i = 0; i < 5; i++) {
    const match = players[i].snapshot!.mafiaMatch!;
    assert.equal(match.seat, i);
    assert.ok(validSnapshot(players[i].snapshot));
    assert.equal('roles' in JSON.parse(JSON.stringify(match.view)), false);
    assert.equal('actions' in match.view, false);
  }
  const hidden = JSON.parse(cache.get('arcade:redesign:room:v9')!).privateMafia;
  const spy = hidden.roles.indexOf('mafia'),
    doctor = hidden.roles.indexOf('doctor'),
    detective = hidden.roles.indexOf('detective'),
    victim = hidden.roles.findIndex(
      (r: string, i: number) =>
        r !== 'mafia' && i !== doctor && i !== detective,
    );
  const restored = new Room(factory);
  restored.restore();
  assert.equal(
    restored.snapshot?.mafiaMatch?.view.role,
    players[0].snapshot?.mafiaMatch?.view.role,
  );
  host.leave();
  for (let i = 1; i < 5; i++) await connect(restored, players[i]);
  players[0] = restored;
  for (const actor of [spy, doctor, detective]) {
    players[actor].mafiaAction({
      type: 'mafia-act',
      target: actor === detective ? spy : victim,
    });
    await flush();
  }
  restored.mafiaAction({ type: 'mafia-resolve' });
  await flush();
  assert.equal(restored.snapshot!.mafiaMatch!.view.phase, 'discussion');
  assert.equal(
    players[detective].snapshot!.mafiaMatch!.view.clues[0].mafia,
    true,
  );
  for (let i = 0; i < 5; i++)
    if (i !== detective)
      assert.equal(players[i].snapshot!.mafiaMatch!.view.clues.length, 0);
  restored.mafiaAction({ type: 'mafia-next' });
  await flush();
  for (let i = 0; i < 5; i++) {
    players[i].mafiaAction({
      type: 'mafia-act',
      target: i === spy ? (spy === 0 ? 1 : 0) : spy,
    });
    await flush();
  }
  restored.mafiaAction({ type: 'mafia-resolve' });
  await flush();
  assert.equal(restored.snapshot!.mafiaMatch!.view.winner, 'town');
  assert.equal(restored.snapshot!.wins.filter((n) => n === 1).length, 4);
  assert.equal(
    restored.snapshot!.standings!.players.filter(
      (p) => p.games.mafia!.wins === 1,
    ).length,
    4,
  );
  assert.equal(
    restored.snapshot!.standings!.players.filter(
      (p) => p.games.mafia!.losses === 1,
    ).length,
    1,
  );
  for (const p of players)
    assert.equal(p.snapshot!.mafiaMatch!.view.roles?.[spy], 'mafia');
  restored.start();
  await flush();
  assert.equal(players[1].snapshot!.mafiaMatch!.round, 1);
  for (const p of players) p.leave();
});

test('Mafia host can skip a disconnected pending seat but not a connected one', async () => {
  cache.clear();
  const host = new Room(factory);
  host.createHost('Mira');
  const players = [host];
  for (let i = 1; i < 5; i++) {
    const g = new Room(factory);
    await connect(host, g);
    players.push(g);
  }
  host.start('mafia');
  await flush();
  const pending = host.snapshot!.mafiaMatch!.view.pending,
    guestSeat = pending.find((i) => i > 0)!;
  const revision = host.snapshot!.mafiaMatch!.revision;
  host.mafiaAction({ type: 'mafia-skip', target: guestSeat });
  await flush();
  assert.equal(host.snapshot!.mafiaMatch!.revision, revision);
  players[guestSeat].leave();
  await flush();
  host.mafiaAction({ type: 'mafia-skip', target: guestSeat });
  await flush();
  assert.ok(host.snapshot!.mafiaMatch!.view.skipped.includes(guestSeat));
  for (const p of players) p.leave();
});
test('v4 duel host backup restores into v9', async () => {
  cache.clear();
  const host = new Room(factory),
    guest = new Room(factory);
  host.createHost('Mira');
  await connect(host, guest);
  host.start('chess');
  await flush();
  const saved = cache.get('arcade:redesign:room:v9')!;
  host.leave();
  cache.set('arcade:redesign:room:v4', saved);
  const restored = new Room(factory);
  restored.restore();
  assert.equal(restored.snapshot?.chessMatch?.gameId, 'chess');
  assert.equal(readSignal(await restored.createInvite(), 'offer').version, 9);
  restored.leave();
  guest.leave();
});

test('Mafia rejects an unauthorized guest action with private recovery guidance', async () => {
  cache.clear();
  const host = new Room(factory);
  host.createHost('Mira');
  const guests: Room[] = [];
  for (let i = 0; i < 4; i++) {
    const g = new Room(factory);
    await connect(host, g);
    guests.push(g);
  }
  host.start('mafia');
  await flush();
  const before = host.snapshot!.mafiaMatch!.revision;
  guests[0].mafiaAction({ type: 'mafia-next' });
  await flush();
  assert.equal(host.snapshot!.mafiaMatch!.revision, before);
  assert.match(guests[0].issue, /not available/);
  assert.equal(guests[1].issue, '');
  for (const p of [host, ...guests]) p.leave();
});

test('Business room hides decks, rejects forged dice and restores the host before a trade', async () => {
  cache.clear();
  const host = new Room(factory),
    guest = new Room(factory);
  host.createHost('Mira');
  await connect(host, guest);
  host.start('business', { turnLimit: 30 });
  await flush();
  const view = guest.snapshot!.businessMatch!.view;
  assert.equal('decks' in view, false);
  assert.ok(validSnapshot(guest.snapshot));
  assert.ok(
    JSON.parse(cache.get('arcade:redesign:room:v9')!).privateBusiness.decks,
  );
  guest.businessAction({ type: 'end' });
  await flush();
  assert.match(guest.issue, /Wait for the current player/);
  assert.equal(host.issue, '');
  guest.businessAction({ type: 'roll', dice: [6, 6] });
  await flush();
  assert.equal(host.snapshot!.businessMatch!.revision, 0);
  const restored = new Room(factory);
  restored.restore();
  assert.deepEqual(restored.snapshot!.businessMatch!.view, view);
  host.leave();
  await connect(restored, guest);
  restored.businessAction({
    type: 'offer',
    to: 1,
    offered: [],
    wanted: [],
    cashOut: 10,
    cashIn: 0,
    cardsOut: 0,
    cardsIn: 0,
  });
  await flush();
  assert.equal(guest.snapshot!.businessMatch!.view.offer?.to, 1);
  guest.businessAction({ type: 'accept' });
  await flush();
  assert.equal(
    restored.snapshot!.businessMatch!.view.players[1].cash,
    view.players[1].cash + 10,
  );
  assert.equal(guest.snapshot!.businessMatch!.view.offer, null);
  restored.leave();
  guest.leave();
});

test('v5 Mafia host backup restores into v9 with private roles intact', async () => {
  cache.clear();
  const host = new Room(factory),
    guests: Room[] = [];
  host.createHost('Mira');
  for (let i = 0; i < 4; i++) {
    const guest = new Room(factory);
    await connect(host, guest);
    guests.push(guest);
  }
  host.start('mafia');
  await flush();
  const role = host.snapshot!.mafiaMatch!.view.role;
  const saved = cache.get('arcade:redesign:room:v9')!;
  host.leave();
  const legacy = JSON.parse(saved);
  delete legacy.snapshot.businessMatch;
  delete legacy.privateBusiness;
  cache.set('arcade:redesign:room:v5', JSON.stringify(legacy));
  const restored = new Room(factory);
  restored.restore();
  assert.equal(restored.snapshot!.mafiaMatch!.view.role, role);
  assert.equal(readSignal(await restored.createInvite(), 'offer').version, 9);
  restored.leave();
  for (const guest of guests) guest.leave();
});

test('Business room records a completed game once and replays with its house rules', async () => {
  cache.clear();
  const host = new Room(factory),
    guest = new Room(factory);
  host.createHost('Mira');
  await connect(host, guest);
  host.start('business', { turnLimit: 1 });
  await flush();
  const backup = JSON.parse(cache.get('arcade:redesign:room:v9')!);
  backup.privateBusiness = actBusiness(
    backup.privateBusiness,
    { type: 'roll', dice: [1, 3] },
    0,
    () => 0.2,
  );
  backup.snapshot.businessMatch.view = publicBusiness(backup.privateBusiness);
  backup.snapshot.businessMatch.revision = backup.privateBusiness.revision;
  host.leave();
  cache.set('arcade:redesign:room:v9', JSON.stringify(backup));
  const restored = new Room(factory);
  restored.restore();
  await connect(restored, guest);
  restored.businessAction({ type: 'end' });
  await flush();
  assert.equal(guest.snapshot!.businessMatch!.view.phase, 'win');
  assert.equal(
    restored.snapshot!.wins.reduce((a, b) => a + b, 0),
    1,
  );
  restored.businessAction({ type: 'end' });
  assert.equal(
    restored.snapshot!.wins.reduce((a, b) => a + b, 0),
    1,
  );
  restored.start();
  await flush();
  assert.equal(guest.snapshot!.businessMatch!.round, 1);
  assert.equal(guest.snapshot!.businessMatch!.view.options.turnLimit, 1);
  restored.leave();
  guest.leave();
});

test('Island room keeps each cargo hand private and restores the host', async () => {
  cache.clear();
  const host = new Room(factory),
    guests = [new Room(factory), new Room(factory)];
  host.createHost('Mira');
  for (const guest of guests) await connect(host, guest);
  host.start('catan');
  await flush();
  for (const [seat, player] of [host, ...guests].entries()) {
    const match = player.snapshot!.islandMatch!;
    assert.equal(match.seat, seat);
    assert.equal('players' in match.view, false);
    assert.equal('deck' in match.view, false);
    assert.ok(validSnapshot(player.snapshot));
  }
  guests[0].islandAction({ type: 'setup-roll', dice: [6, 6] });
  await flush();
  assert.equal(host.snapshot!.islandMatch!.revision, 0);
  host.islandAction({ type: 'setup-roll' });
  await flush();
  assert.equal(guests[0].snapshot!.islandMatch!.revision, 1);
  const restored = new Room(factory);
  restored.restore();
  assert.deepEqual(
    restored.snapshot!.islandMatch!.view,
    host.snapshot!.islandMatch!.view,
  );
  host.leave();
  for (const guest of guests) await connect(restored, guest);
  guests[0].islandAction({ type: 'setup-roll' });
  await flush();
  assert.equal(restored.snapshot!.islandMatch!.revision, 2);
  restored.leave();
  for (const guest of guests) guest.leave();
});

test('v6 Business backups restore into v9 and are removed when leaving', async () => {
  cache.clear();
  const host = new Room(factory),
    guest = new Room(factory);
  host.createHost('Mira');
  await connect(host, guest);
  host.start('business');
  await flush();
  const saved = JSON.parse(cache.get('arcade:redesign:room:v9')!);
  delete saved.snapshot.islandMatch;
  delete saved.privateIsland;
  host.leave();
  cache.set('arcade:redesign:room:v6', JSON.stringify(saved));
  const restored = new Room(factory);
  restored.restore();
  assert.equal(restored.snapshot?.businessMatch?.gameId, 'business');
  assert.equal(readSignal(await restored.createInvite(), 'offer').version, 9);
  restored.leave();
  assert.equal(cache.has('arcade:redesign:room:v6'), false);
  guest.leave();
});

test('v7 room backups retain aggregate wins while new per-game standings start honestly', async () => {
  cache.clear();
  const host = new Room(factory),
    guest = new Room(factory);
  host.createHost('Mira');
  await connect(host, guest);
  host.start();
  await flush();
  const saved = JSON.parse(cache.get('arcade:redesign:room:v9')!);
  saved.snapshot.wins = [3, 2];
  delete saved.snapshot.standings;
  cache.clear();
  cache.set('arcade:redesign:room:v7', JSON.stringify(saved));
  const restored = new Room(factory);
  restored.restore();
  assert.deepEqual(restored.snapshot!.wins, [3, 2]);
  assert.equal(restored.snapshot!.standings, undefined);
  assert.equal(readSignal(await restored.createInvite(), 'offer').version, 9);
  restored.leave();
  host.leave();
  guest.leave();
});

test('spectators receive public-only projections for every room game and cannot act or pause players', async () => {
  for (const game of [
    'tictactoe',
    'connect-four',
    'crazy-eights',
    'uno',
    'snakes-ladders',
    'ludo',
    'chess',
    'rps',
    'mafia',
    'business',
    'catan',
  ] as const) {
    cache.clear();
    const host = new Room(factory),
      viewer = new Room(factory);
    const guests = Array.from(
      { length: game === 'mafia' ? 4 : game === 'catan' ? 2 : 1 },
      () => new Room(factory),
    );
    host.createHost('Mira');
    for (const guest of guests) await connect(host, guest);
    host.start(game);
    await flush();
    const offer = await host.createInvite(undefined, true);
    assert.equal(readSignal(offer, 'offer').spectating, true);
    await host.acceptAnswer(await viewer.joinInvite(offer, 'Watcher'));
    await flush();
    assert.ok(validSnapshot(viewer.snapshot), game);
    assert.equal(viewer.snapshot!.members.length, guests.length + 1);
    assert.equal(viewer.snapshot!.spectators![0].id, viewer.peerId);
    const snapshot = viewer.snapshot!;
    if (snapshot.cardMatch) {
      assert.equal(snapshot.cardMatch.view.seat, -1);
      assert.deepEqual(snapshot.cardMatch.view.hand, []);
      assert.deepEqual(snapshot.cardMatch.view.legal, []);
    }
    if (snapshot.rpsMatch) {
      assert.equal(snapshot.rpsMatch.view.seat, -1);
      assert.equal(snapshot.rpsMatch.view.ownPick, null);
    }
    if (snapshot.mafiaMatch) {
      assert.equal(snapshot.mafiaMatch.view.role, 'spectator');
      assert.deepEqual(snapshot.mafiaMatch.view.clues, []);
      assert.deepEqual(snapshot.mafiaMatch.view.allies, []);
      assert.equal(snapshot.mafiaMatch.view.roles, undefined);
    }
    if (snapshot.islandMatch) {
      assert.equal(snapshot.islandMatch.seat, -1);
      assert.deepEqual(snapshot.islandMatch.view.dev, []);
      assert.ok(
        Object.values(snapshot.islandMatch.view.goods).every((n) => n === 0),
      );
    }
    const leaked = structuredClone(snapshot);
    if (leaked.cardMatch) {
      leaked.cardMatch.view.hand = host.snapshot!.cardMatch!.view.hand;
      assert.equal(validSnapshot(leaked), false);
    }
    if (leaked.rpsMatch) {
      leaked.rpsMatch.view.ownPick = 'rock';
      assert.equal(validSnapshot(leaked), false);
    }
    if (leaked.mafiaMatch) {
      leaked.mafiaMatch.view.role = host.snapshot!.mafiaMatch!.view.role;
      assert.equal(validSnapshot(leaked), false);
    }
    if (leaked.islandMatch) {
      leaked.islandMatch.view.goods.timber = 1;
      assert.equal(validSnapshot(leaked), false);
    }
    const before = JSON.stringify(host.snapshot);
    viewer.move(0);
    viewer.cardAction({ type: 'draw' });
    viewer.raceAction({ type: 'roll' });
    viewer.rpsAction({ type: 'pick', choice: 'rock' });
    viewer.chessAction({ type: 'move', from: 12, to: 28 });
    viewer.mafiaAction({ type: 'mafia-act', target: 0 });
    viewer.businessAction({ type: 'roll' });
    viewer.islandAction({ type: 'setup-roll' });
    await flush();
    assert.equal(JSON.stringify(host.snapshot), before, game);
    viewer.leave();
    await flush();
    assert.ok(
      host.snapshot!.members.every((m) => m.connected),
      game,
    );
    host.start(game);
    await flush();
    assert.ok(
      host.snapshot!.members.every((m) => m.connected),
      game,
    );
    host.leave();
    for (const guest of guests) guest.leave();
  }
});

test('host selects spectators in the lobby, preserves result identities and recovers spectator seats', async () => {
  cache.clear();
  const host = new Room(factory),
    guest = new Room(factory),
    third = new Room(factory);
  host.createHost('Mira');
  await connect(host, guest);
  await connect(host, third);
  host.setSpectating(third.peerId, true);
  await flush();
  assert.equal(third.snapshot!.members.length, 2);
  assert.equal(third.snapshot!.spectators![0].id, third.peerId);
  assert.throws(() => host.setSpectating(host.peerId, true), /host must play/);
  host.start();
  await flush();
  assert.throws(() => host.setSpectating(guest.peerId, true), /lobby/);
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
  host.returnLobby();
  await flush();
  host.setSpectating(guest.peerId, true);
  host.setSpectating(third.peerId, false);
  await flush();
  host.start();
  await flush();
  assert.equal(host.snapshot!.match!.round, 1);
  assert.equal(host.snapshot!.standings!.players.length, 2);
  const restored = new Room(factory);
  restored.restore();
  assert.equal(restored.snapshot!.spectators![0].connected, false);
  assert.equal(restored.snapshot!.members.length, 2);
  const reconnect = await restored.createInvite(guest.peerId);
  assert.equal(readSignal(reconnect, 'offer').spectating, true);
  host.leave();
  restored.leave();
  guest.leave();
  third.leave();
});

test('v8 standings backups migrate without losing per-game results', async () => {
  cache.clear();
  const host = new Room(factory),
    guest = new Room(factory);
  host.createHost('Mira');
  await connect(host, guest);
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
  const saved = JSON.parse(cache.get('arcade:redesign:room:v9')!);
  delete saved.snapshot.spectators;
  delete saved.snapshot.spectatorWins;
  delete saved.snapshot.nextRound;
  cache.clear();
  cache.set('arcade:redesign:room:v8', JSON.stringify(saved));
  const restored = new Room(factory);
  restored.restore();
  assert.deepEqual(restored.snapshot!.standings, host.snapshot!.standings);
  assert.equal(readSignal(await restored.createInvite(), 'offer').version, 9);
  restored.leave();
  host.leave();
  guest.leave();
});
