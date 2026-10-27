import { applyMove, emptyBoard, findWin, isValidState } from '../tictactoe.ts';
import type { LocalState } from '../tictactoe.ts';
import { waitForIce, webrtcConnectionFactory } from './transport.ts';
import type { ConnectionFactory } from './transport.ts';

export interface Member {
  id: string;
  name: string;
  connected: boolean;
}
export interface Match extends LocalState {
  mode: 'pvp';
  round: number;
  revision: number;
}
export interface RoomSnapshot {
  roomId: string;
  members: Member[];
  match: Match | null;
  wins: [number, number];
  draws: number;
}
interface Signal {
  version: 1;
  kind: 'offer' | 'answer';
  roomId: string;
  host: string;
  guest: string;
  name: string;
  description: RTCSessionDescriptionInit;
}
const BACKUP = 'arcade:redesign:room:v1';
const UUID = /^[a-f0-9-]{36}$/i;
const validId = (id: unknown): id is string =>
  typeof id === 'string' && UUID.test(id);
const validName = (name: unknown): name is string =>
  typeof name === 'string' && !!name.trim() && name.length <= 24;
const integer = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) >= 0;

export function validSnapshot(value: unknown): value is RoomSnapshot {
  const s = value as RoomSnapshot;
  return (
    !!s &&
    typeof s === 'object' &&
    validId(s.roomId) &&
    Array.isArray(s.members) &&
    s.members.length >= 1 &&
    s.members.length <= 2 &&
    s.members.every(
      (m) =>
        m &&
        validId(m.id) &&
        validName(m.name) &&
        typeof m.connected === 'boolean',
    ) &&
    new Set(s.members.map((m) => m.id)).size === s.members.length &&
    Array.isArray(s.wins) &&
    s.wins.length === 2 &&
    s.wins.every(integer) &&
    integer(s.draws) &&
    (s.match === null ||
      (s.members.length === 2 &&
        isValidState(s.match, true) &&
        s.match.mode === 'pvp' &&
        integer(s.match.round) &&
        integer(s.match.revision)))
  );
}

function signalLink(signal: Signal, base: string) {
  const bytes = new TextEncoder().encode(JSON.stringify(signal));
  const encoded = btoa(
    Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''),
  );
  const url = new URL(base);
  url.search = '';
  url.hash = `/room?${signal.kind === 'offer' ? 'invite' : 'answer'}=${encodeURIComponent(encoded)}`;
  if (url.href.length > 24_000)
    throw new Error('This connection link is too large. Try another network.');
  return url.href;
}
export function readSignal(input: string, kind: Signal['kind']): Signal {
  if (!input || input.length > 24_000)
    throw new Error('Paste a complete connection link.');
  try {
    const url = new URL(input.trim());
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    const params = new URLSearchParams(url.hash.split('?')[1]);
    const values = params.getAll(kind === 'offer' ? 'invite' : 'answer');
    if (values.length !== 1) throw new Error();
    const raw = atob(values[0]);
    const s = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        Uint8Array.from(raw, (c) => c.charCodeAt(0)),
      ),
    );
    if (
      s.version !== 1 ||
      s.kind !== kind ||
      !validId(s.roomId) ||
      !validId(s.host) ||
      !validId(s.guest) ||
      s.host === s.guest ||
      !validName(s.name) ||
      s.description?.type !== kind ||
      typeof s.description.sdp !== 'string' ||
      !s.description.sdp.startsWith('v=0')
    )
      throw new Error();
    return s;
  } catch {
    throw new Error(
      `Invalid ${kind === 'offer' ? 'invitation' : 'answer'} link. Ask for a fresh link.`,
    );
  }
}

/** One host and one guest, public Tic-Tac-Toe only. Guests submit intentions;
 * the host commits the board and checks seat, round and revision each time. */
export class Room {
  role: 'host' | 'guest' | null = null;
  peerId = '';
  snapshot: RoomSnapshot | null = null;
  issue = '';
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private listeners = new Set<() => void>();
  private pendingGuest = '';
  private accepted = false;
  private generation = 0;
  private connectionTimer: ReturnType<typeof setTimeout> | undefined;
  private sequence = 0;
  private received = 0;
  private factory: ConnectionFactory;
  private base: string;
  constructor(
    factory = webrtcConnectionFactory,
    base = typeof location === 'undefined'
      ? 'http://127.0.0.1/'
      : location.href,
  ) {
    this.factory = factory;
    this.base = base;
  }
  on(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit() {
    for (const listener of this.listeners) listener();
  }
  private checkpoint() {
    if (this.role !== 'host' || !this.snapshot) return;
    try {
      sessionStorage.setItem(BACKUP, JSON.stringify(this.snapshot));
    } catch {
      this.issue = 'Room recovery cannot be saved. Keep this tab open.';
    }
  }
  restore() {
    if (this.role) return;
    try {
      const saved: unknown = JSON.parse(
        sessionStorage.getItem(BACKUP) ?? 'null',
      );
      if (!validSnapshot(saved)) return;
      this.snapshot = structuredClone(saved);
      this.role = 'host';
      this.peerId = saved.members[0].id;
      this.snapshot.members.forEach((m, index) => {
        m.connected = index === 0;
      });
      this.issue =
        'Room restored. Send your guest a reconnect invitation to continue.';
      this.emit();
    } catch {
      /* Invalid or unavailable tab storage must not prevent local play. */
    }
  }
  createHost(name: string) {
    if (!validName(name)) throw new Error('Enter a name of 1–24 characters.');
    this.leave();
    this.role = 'host';
    this.peerId = crypto.randomUUID();
    this.snapshot = {
      roomId: crypto.randomUUID(),
      members: [{ id: this.peerId, name: name.trim(), connected: true }],
      match: null,
      wins: [0, 0],
      draws: 0,
    };
    this.checkpoint();
    this.emit();
  }
  private disconnectTransport() {
    clearTimeout(this.connectionTimer);
    this.generation++;
    if (this.channel) {
      this.channel.onclose = null;
      this.channel.onmessage = null;
      this.channel.onopen = null;
      this.channel.close();
    }
    if (this.pc) {
      this.pc.onconnectionstatechange = null;
      this.pc.ondatachannel = null;
      this.pc.close();
    }
    this.pc = null;
    this.channel = null;
    this.sequence = 0;
    this.received = 0;
  }
  private connection(): RTCPeerConnection {
    this.disconnectTransport();
    const pc = this.factory();
    this.pc = pc;
    pc.onconnectionstatechange = () => {
      if (
        this.pc === pc &&
        ['failed', 'disconnected', 'closed'].includes(pc.connectionState)
      )
        this.disconnected();
    };
    return pc;
  }
  private disconnected() {
    if (!this.snapshot) return;
    this.snapshot.members.forEach((m) => {
      if (m.id !== this.peerId) m.connected = false;
    });
    this.issue =
      'Connection lost. Keep both tabs open; the host can send a reconnect invitation.';
    this.checkpoint();
    this.emit();
  }
  private attach(channel: RTCDataChannel, pc: RTCPeerConnection) {
    this.channel = channel;
    channel.onopen = () => {
      if (this.pc !== pc) return;
      clearTimeout(this.connectionTimer);
      this.issue = '';
      if (this.role === 'guest')
        this.send({
          type: 'hello',
          name: this.snapshot?.members.find((m) => m.id === this.peerId)?.name,
        });
      this.emit();
    };
    channel.onclose = () => {
      if (this.pc === pc) this.disconnected();
    };
    channel.onerror = () => {
      if (this.pc === pc) this.disconnected();
    };
    channel.onmessage = (event) => {
      if (this.pc !== pc) return;
      try {
        this.receive(event.data);
      } catch {
        this.issue =
          'An invalid room message was ignored. Reconnect if play cannot continue.';
        this.emit();
      }
    };
  }
  private send(fields: Record<string, unknown>) {
    if (!this.snapshot || this.channel?.readyState !== 'open')
      throw new Error('Your opponent is not connected. Reconnect to continue.');
    this.channel.send(
      JSON.stringify({
        ...fields,
        version: 1,
        roomId: this.snapshot.roomId,
        sender: this.peerId,
        sequence: ++this.sequence,
      }),
    );
  }
  private publish() {
    this.checkpoint();
    if (this.channel?.readyState === 'open')
      this.send({ type: 'snapshot', snapshot: this.snapshot });
    this.emit();
  }
  private receive(raw: unknown) {
    if (typeof raw !== 'string' || raw.length > 32_000 || !this.snapshot)
      throw new Error();
    const m = JSON.parse(raw);
    const other =
      this.role === 'host' ? this.pendingGuest : this.snapshot.members[0].id;
    if (
      m.version !== 1 ||
      m.roomId !== this.snapshot.roomId ||
      m.sender !== other ||
      !integer(m.sequence) ||
      m.sequence <= this.received
    )
      throw new Error();
    this.received = m.sequence;
    if (this.role === 'host') {
      if (m.type === 'hello' && this.accepted && validName(m.name)) {
        const guest = this.snapshot.members[1];
        if (!guest || guest.id !== other || guest.name !== m.name)
          throw new Error();
        guest.connected = true;
        this.issue = '';
        this.publish();
      } else if (m.type === 'move')
        this.commitMove(other, m.cell, m.round, m.revision);
      else if (m.type === 'sync') this.publish();
      else throw new Error();
    } else {
      if (
        m.type !== 'snapshot' ||
        !validSnapshot(m.snapshot) ||
        m.snapshot.roomId !== this.snapshot.roomId ||
        m.snapshot.members[0].id !== other ||
        m.snapshot.members[1]?.id !== this.peerId
      )
        throw new Error();
      const previous = this.snapshot.match;
      const next = m.snapshot.match as Match | null;
      if (
        previous &&
        next &&
        (next.round < previous.round ||
          (next.round === previous.round && next.revision < previous.revision))
      )
        throw new Error();
      this.snapshot = m.snapshot;
      this.issue = '';
      this.emit();
    }
  }
  async createInvite(): Promise<string> {
    if (this.role !== 'host' || !this.snapshot)
      throw new Error('Create a room first.');
    const guest = this.snapshot.members[1]?.id ?? crypto.randomUUID();
    if (this.snapshot.members[1]) this.snapshot.members[1].connected = false;
    this.pendingGuest = guest;
    this.accepted = false;
    const pc = this.connection();
    const generation = this.generation;
    this.attach(pc.createDataChannel('arcade-redesign', { ordered: true }), pc);
    await pc.setLocalDescription(await pc.createOffer());
    await waitForIce(pc);
    if (generation !== this.generation)
      throw new Error('Invitation cancelled.');
    this.issue =
      'Send the invitation, then paste your guest’s answer into this tab.';
    this.emit();
    return signalLink(
      {
        version: 1,
        kind: 'offer',
        roomId: this.snapshot.roomId,
        host: this.peerId,
        guest,
        name: this.snapshot.members[0].name,
        description: pc.localDescription!.toJSON(),
      },
      this.base,
    );
  }
  async joinInvite(link: string, name: string): Promise<string> {
    if (!validName(name)) throw new Error('Enter a name of 1–24 characters.');
    const offer = readSignal(link, 'offer');
    this.leave();
    this.role = 'guest';
    this.peerId = offer.guest;
    this.snapshot = {
      roomId: offer.roomId,
      members: [
        { id: offer.host, name: offer.name, connected: false },
        { id: offer.guest, name: name.trim(), connected: false },
      ],
      match: null,
      wins: [0, 0],
      draws: 0,
    };
    const pc = this.connection();
    const generation = this.generation;
    pc.ondatachannel = (event) => {
      if (
        this.pc !== pc ||
        event.channel.label !== 'arcade-redesign' ||
        this.channel
      ) {
        event.channel.close();
        return;
      }
      this.attach(event.channel, pc);
    };
    await pc.setRemoteDescription(offer.description);
    await pc.setLocalDescription(await pc.createAnswer());
    await waitForIce(pc);
    if (generation !== this.generation)
      throw new Error('Invitation cancelled.');
    this.issue = 'Send your answer back to the host. Keep this tab open.';
    this.emit();
    return signalLink(
      {
        ...offer,
        kind: 'answer',
        name: name.trim(),
        description: pc.localDescription!.toJSON(),
      },
      this.base,
    );
  }
  async acceptAnswer(link: string) {
    const answer = readSignal(link, 'answer');
    if (
      this.role !== 'host' ||
      !this.snapshot ||
      !this.pc ||
      this.accepted ||
      answer.roomId !== this.snapshot.roomId ||
      answer.host !== this.peerId ||
      answer.guest !== this.pendingGuest
    )
      throw new Error('This answer does not match the pending invitation.');
    const existing = this.snapshot.members[1];
    if (existing && existing.name !== answer.name) {
      this.disconnectTransport();
      this.pendingGuest = '';
      throw new Error(
        'Reconnect with the same room name. Create a fresh invitation; your seat and board are preserved.',
      );
    }
    // Admission is committed before the data channel opens and sends hello.
    this.snapshot.members[1] = {
      id: answer.guest,
      name: answer.name,
      connected: false,
    };
    this.accepted = true;
    await this.pc.setRemoteDescription(answer.description);
    this.connectionTimer = setTimeout(() => {
      if (this.channel?.readyState !== 'open') {
        this.issue =
          'Could not reach your guest. Try another network, then create a fresh reconnect invitation.';
        this.emit();
      }
    }, 20_000);
    this.issue = 'Connecting to your guest…';
    this.checkpoint();
    this.emit();
  }
  start() {
    if (
      this.role !== 'host' ||
      !this.snapshot ||
      this.snapshot.members.length !== 2 ||
      !this.snapshot.members.every((m) => m.connected)
    )
      throw new Error('Wait for both players to connect.');
    this.snapshot.match = {
      mode: 'pvp',
      board: emptyBoard(),
      current: 1,
      over: false,
      round: (this.snapshot.match?.round ?? -1) + 1,
      revision: 0,
    };
    this.publish();
  }
  move(cell: number) {
    const s = this.snapshot?.match;
    if (!s) return;
    if (this.role === 'host')
      this.commitMove(this.peerId, cell, s.round, s.revision);
    else
      this.send({ type: 'move', cell, round: s.round, revision: s.revision });
  }
  private commitMove(
    sender: string,
    cell: number,
    round: number,
    revision: number,
  ) {
    const room = this.snapshot,
      s = room?.match;
    if (
      !room ||
      !s ||
      s.over ||
      room.members[s.current - 1]?.id !== sender ||
      !room.members.every((m) => m.connected) ||
      s.round !== round ||
      s.revision !== revision
    )
      return;
    if (!Number.isInteger(cell) || cell < 0 || cell > 8 || s.board[cell] !== 0)
      return;
    const result = applyMove(s.board, s.current, cell);
    room.match = {
      ...s,
      board: result.board,
      current: result.current,
      over: result.finished,
      revision: s.revision + 1,
    };
    if (result.finished) {
      if (result.win) room.wins[result.current - 1]++;
      else room.draws++;
    }
    this.publish();
  }
  leave() {
    this.disconnectTransport();
    this.role = null;
    this.peerId = '';
    this.snapshot = null;
    this.issue = '';
    this.pendingGuest = '';
    this.accepted = false;
    try {
      sessionStorage.removeItem(BACKUP);
    } catch {
      /* No stored room. */
    }
    this.emit();
  }
}
