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
