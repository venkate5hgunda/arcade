import {
  newCards,
  applyCards,
  cardView,
  validCardView,
  validCardState,
  finishedCards,
} from '../cards.ts';
import type { CardGameId, CardState, CardView } from '../cards.ts';
import { c4Drop, c4Win, validC4 } from '../puzzles.ts';
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
  gameId?: 'tictactoe' | 'connect-four';
  round: number;
  revision: number;
}
export interface RoomSnapshot {
  roomId: string;
  members: Member[];
  match: Match | null;
  cardMatch?: CardMatch | null;
  wins: number[];
  draws: number;
}
export type RoomGameId = 'tictactoe' | 'connect-four' | CardGameId;
export interface CardMatch {
  gameId: CardGameId;
  round: number;
  revision: number;
  view: CardView;
}
interface Signal {
  version: 2;
  kind: 'offer' | 'answer';
  roomId: string;
  host: string;
  guest: string;
  name: string;
  description: RTCSessionDescriptionInit;
}
const BACKUP = 'arcade:redesign:room:v2';
const OLD_BACKUP = 'arcade:redesign:room:v1';
const UUID = /^[a-f0-9-]{36}$/i;
const validId = (id: unknown): id is string =>
  typeof id === 'string' && UUID.test(id);
const validName = (name: unknown): name is string =>
  typeof name === 'string' && !!name.trim() && name.length <= 24;
const integer = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) >= 0;
const incompatibleLink =
  'This link uses an incompatible Arcade version. Both players should reload the same version and request a fresh link.';

export function validSnapshot(value: unknown): value is RoomSnapshot {
  const s = value as RoomSnapshot;
  return (
    !!s &&
    typeof s === 'object' &&
    Object.keys(s).every((k) =>
      ['roomId', 'members', 'match', 'cardMatch', 'wins', 'draws'].includes(k),
    ) &&
    validId(s.roomId) &&
    Array.isArray(s.members) &&
    s.members.length >= 1 &&
    s.members.length <= 20 &&
    s.members.every(
      (m) =>
        m &&
        Object.keys(m).length === 3 &&
        validId(m.id) &&
        validName(m.name) &&
        typeof m.connected === 'boolean',
    ) &&
    new Set(s.members.map((m) => m.id)).size === s.members.length &&
    Array.isArray(s.wins) &&
    s.wins.length === Math.max(2, s.members.length) &&
    s.wins.every(integer) &&
    integer(s.draws) &&
    (s.cardMatch == null ||
      (!s.match &&
        integer(s.cardMatch.round) &&
        integer(s.cardMatch.revision) &&
        ['crazy-eights', 'uno'].includes(s.cardMatch.gameId) &&
        !!s.cardMatch.view &&
        s.cardMatch.gameId === s.cardMatch.view.gameId &&
        validCardView(
          s.cardMatch.view,
          s.members.length,
          s.cardMatch.view.seat,
        ) &&
        Object.keys(s.cardMatch).length === 4)) &&
    (s.match === null ||
      (!!s.match &&
        s.members.length === 2 &&
        (s.match.gameId === 'connect-four'
          ? validC4(s.match, true)
          : (!s.match.gameId || s.match.gameId === 'tictactoe') &&
            isValidState(s.match, true)) &&
        Object.keys(s.match).every((k) =>
          [
            'mode',
            'board',
            'current',
            'over',
            'gameId',
            'round',
            'revision',
          ].includes(k),
        ) &&
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
    if (s && typeof s === 'object' && s.version !== 2)
      throw new Error(incompatibleLink);
    if (
      !s ||
      typeof s !== 'object' ||
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
  } catch (error) {
    if (error instanceof Error && error.message === incompatibleLink)
      throw error;
    throw new Error(
      `Invalid ${kind === 'offer' ? 'invitation' : 'answer'} link. Ask for a fresh link.`,
    );
  }
}

interface PeerLink {
  id: string;
  pc: RTCPeerConnection;
  channel: RTCDataChannel | null;
  accepted: boolean;
  sequence: number;
  received: number;
  timer?: ReturnType<typeof setTimeout>;
}
/** The host owns all rules/decks. Every data channel receives a seat-specific projection. */
export class Room {
  role: 'host' | 'guest' | null = null;
  peerId = '';
  snapshot: RoomSnapshot | null = null;
  issue = '';
  private peers = new Map<string, PeerLink>();
  private pendingGuest = '';
  private listeners = new Set<() => void>();
  private privateGame: CardState | null = null;
  constructor(
    private factory: ConnectionFactory = webrtcConnectionFactory,
    private base = typeof location === 'undefined'
      ? 'http://127.0.0.1/'
      : location.href,
  ) {}
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
      sessionStorage.setItem(
        BACKUP,
        JSON.stringify({
          snapshot: this.snapshot,
          privateGame: this.privateGame,
        }),
      );
    } catch {
      this.issue = 'Room recovery cannot be saved. Keep this tab open.';
    }
  }
  restore() {
    if (this.role) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(BACKUP) ?? 'null');
      const snapshot: unknown =
        saved?.snapshot ??
        JSON.parse(sessionStorage.getItem(OLD_BACKUP) ?? 'null');
      if (!validSnapshot(snapshot)) return;
      if (
        snapshot.cardMatch &&
        (!validCardState(saved?.privateGame, true) ||
          saved.privateGame.gameId !== snapshot.cardMatch.gameId ||
          saved.privateGame.state.hands.length !== snapshot.members.length ||
          JSON.stringify(cardView(saved.privateGame, 0)) !==
            JSON.stringify(snapshot.cardMatch.view))
      )
        return;
      this.snapshot = structuredClone(snapshot);
      this.privateGame = snapshot.cardMatch
        ? structuredClone(saved.privateGame)
        : null;
      this.role = 'host';
      this.peerId = snapshot.members[0].id;
      this.snapshot.members.forEach((m, i) => (m.connected = i === 0));
      this.issue =
        'Room restored. Send each guest a reconnect invitation to continue.';
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
  private closePeer(id: string) {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.peers.delete(id);
    clearTimeout(peer.timer);
    if (peer.channel) {
      peer.channel.onclose = null;
      peer.channel.onmessage = null;
      peer.channel.onopen = null;
      peer.channel.close();
    }
    peer.pc.onconnectionstatechange = null;
    peer.pc.ondatachannel = null;
    peer.pc.close();
  }
  private disconnectTransport() {
    for (const id of [...this.peers.keys()]) this.closePeer(id);
  }
  private connection(id: string): PeerLink {
    this.closePeer(id);
    const pc = this.factory();
    const peer: PeerLink = {
      id,
      pc,
      channel: null,
      accepted: false,
      sequence: 0,
      received: 0,
    };
    this.peers.set(id, peer);
    pc.onconnectionstatechange = () => {
      if (
        this.peers.get(id) === peer &&
        ['failed', 'disconnected', 'closed'].includes(pc.connectionState)
      )
        this.disconnected(id);
    };
    return peer;
  }
  private disconnected(id: string) {
    if (!this.snapshot) return;
    this.snapshot.members.forEach((m) => {
      if (this.role === 'guest' ? m.id !== this.peerId : m.id === id)
        m.connected = false;
    });
    this.issue =
      'Connection lost. Keep the tabs open; the host can send a reconnect invitation.';
    if (this.role === 'host') this.publish();
    else this.emit();
  }
  private attach(channel: RTCDataChannel, peer: PeerLink) {
    peer.channel = channel;
    channel.onopen = () => {
      if (this.peers.get(peer.id) !== peer) return;
      clearTimeout(peer.timer);
      this.issue = '';
      if (this.role === 'guest')
        this.send(
          {
            type: 'hello',
            name: this.snapshot?.members.find((m) => m.id === this.peerId)
              ?.name,
          },
          peer,
        );
      this.emit();
    };
    channel.onclose = () => {
      if (this.peers.get(peer.id) === peer) this.disconnected(peer.id);
    };
    channel.onerror = channel.onclose;
    channel.onmessage = (event) => {
      if (this.peers.get(peer.id) !== peer) return;
      try {
        this.receive(event.data, peer);
      } catch {
        this.issue =
          'An invalid room message was ignored. Reconnect if play cannot continue.';
        this.emit();
      }
    };
  }
  private send(fields: Record<string, unknown>, peer: PeerLink) {
    if (!this.snapshot || peer.channel?.readyState !== 'open')
      throw new Error('Your opponent is not connected. Reconnect to continue.');
    peer.channel.send(
      JSON.stringify({
        ...fields,
        version: 2,
        roomId: this.snapshot.roomId,
        sender: this.peerId,
        sequence: ++peer.sequence,
      }),
    );
  }
  private projection(seat: number): RoomSnapshot {
    const snapshot = structuredClone(this.snapshot!);
    if (snapshot.cardMatch && this.privateGame)
      snapshot.cardMatch.view = cardView(this.privateGame, seat);
    return snapshot;
  }
  private publish() {
    this.checkpoint();
    if (this.snapshot)
      for (const peer of this.peers.values()) {
        const seat = this.snapshot.members.findIndex((m) => m.id === peer.id);
        if (peer.accepted && seat > 0 && peer.channel?.readyState === 'open')
          this.send(
            { type: 'snapshot', snapshot: this.projection(seat) },
            peer,
          );
      }
    this.emit();
  }
  private receive(raw: unknown, peer: PeerLink) {
    if (typeof raw !== 'string' || raw.length > 64000 || !this.snapshot)
      throw new Error();
    const m = JSON.parse(raw);
    if (
      m.version !== 2 ||
      m.roomId !== this.snapshot.roomId ||
      m.sender !== peer.id ||
      !integer(m.sequence) ||
      m.sequence <= peer.received
    )
      throw new Error();
    peer.received = m.sequence;
    if (this.role === 'host') {
      if (m.type === 'hello' && peer.accepted && validName(m.name)) {
        const guest = this.snapshot.members.find(
          (member) => member.id === peer.id,
        );
        if (!guest || guest.name !== m.name) throw new Error();
        guest.connected = true;
        this.issue = '';
        this.publish();
      } else if (m.type === 'move' && peer.accepted)
        this.commitMove(peer.id, m.cell, m.round, m.revision);
      else if (m.type === 'card-action' && peer.accepted)
        this.commitCard(peer.id, m.action, m.round, m.revision);
      else if (m.type === 'sync' && peer.accepted) this.publish();
      else throw new Error();
    } else {
      if (
        m.type !== 'snapshot' ||
        !validSnapshot(m.snapshot) ||
        m.snapshot.roomId !== this.snapshot.roomId ||
        m.snapshot.members[0].id !== peer.id ||
        !m.snapshot.members.some(
          (member: Member) => member.id === this.peerId,
        ) ||
        (m.snapshot.cardMatch &&
          m.snapshot.cardMatch.view.seat !==
            m.snapshot.members.findIndex(
              (member: Member) => member.id === this.peerId,
            ))
      )
        throw new Error();
      const previous = this.snapshot.cardMatch ?? this.snapshot.match,
        next = (m.snapshot as RoomSnapshot).cardMatch ?? m.snapshot.match;
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
  cancelInvite() {
    if (this.role !== 'host') return;
    if (
      this.pendingGuest &&
      !this.snapshot?.members.some((m) => m.id === this.pendingGuest)
    )
      this.closePeer(this.pendingGuest);
    this.pendingGuest = '';
    this.issue = '';
    this.emit();
  }
  async createInvite(guestId?: string): Promise<string> {
    if (this.role !== 'host' || !this.snapshot)
      throw new Error('Create a room first.');
    const existing = guestId
      ? this.snapshot.members.find(
          (m) => m.id === guestId && m.id !== this.peerId,
        )
      : (this.snapshot.members.slice(1).find((m) => !m.connected) ??
        ((this.snapshot.match || this.snapshot.cardMatch) &&
        this.snapshot.members.length === 2
          ? this.snapshot.members[1]
          : undefined));
    if (guestId && !existing)
      throw new Error('Choose an existing guest to reconnect.');
    if (!existing && (this.snapshot.match || this.snapshot.cardMatch))
      throw new Error('Reconnect an existing seat during a match.');
    if (!existing && this.snapshot.members.length >= 20)
      throw new Error('This table already has 20 players.');
    if (
      this.pendingGuest &&
      !this.snapshot.members.some((m) => m.id === this.pendingGuest)
    )
      this.closePeer(this.pendingGuest);
    const guest = existing?.id ?? crypto.randomUUID();
    if (existing) existing.connected = false;
    this.pendingGuest = guest;
    const peer = this.connection(guest);
    this.attach(
      peer.pc.createDataChannel('arcade-redesign', { ordered: true }),
      peer,
    );
    await peer.pc.setLocalDescription(await peer.pc.createOffer());
    await waitForIce(peer.pc);
    if (this.peers.get(guest) !== peer)
      throw new Error('Invitation cancelled.');
    this.issue =
      'Send the invitation, then paste your guest’s answer into this tab.';
    this.publish();
    return signalLink(
      {
        version: 2,
        kind: 'offer',
        roomId: this.snapshot.roomId,
        host: this.peerId,
        guest,
        name: this.snapshot.members[0].name,
        description: peer.pc.localDescription!.toJSON(),
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
    const peer = this.connection(offer.host);
    peer.pc.ondatachannel = (event) => {
      if (
        this.peers.get(peer.id) !== peer ||
        event.channel.label !== 'arcade-redesign' ||
        peer.channel
      ) {
        event.channel.close();
        return;
      }
      this.attach(event.channel, peer);
    };
    await peer.pc.setRemoteDescription(offer.description);
    await peer.pc.setLocalDescription(await peer.pc.createAnswer());
    await waitForIce(peer.pc);
    if (this.peers.get(peer.id) !== peer)
      throw new Error('Invitation cancelled.');
    this.issue = 'Send your answer back to the host. Keep this tab open.';
    this.emit();
    return signalLink(
      {
        ...offer,
        kind: 'answer',
        name: name.trim(),
        description: peer.pc.localDescription!.toJSON(),
      },
      this.base,
    );
  }
  async acceptAnswer(link: string) {
    const answer = readSignal(link, 'answer'),
      peer = this.peers.get(this.pendingGuest);
    if (
      this.role !== 'host' ||
      !this.snapshot ||
      !peer ||
      peer.accepted ||
      answer.roomId !== this.snapshot.roomId ||
      answer.host !== this.peerId ||
      answer.guest !== peer.id
    )
      throw new Error('This answer does not match the pending invitation.');
    const existing = this.snapshot.members.find((m) => m.id === answer.guest);
    if (existing && existing.name !== answer.name) {
      this.closePeer(peer.id);
      this.pendingGuest = '';
      throw new Error(
        'Reconnect with the same room name. Create a fresh invitation; your seat and board are preserved.',
      );
    }
    if (
      !existing &&
      (this.snapshot.match ||
        this.snapshot.cardMatch ||
        this.snapshot.members.length >= 20)
    )
      throw new Error(
        'The table is already playing or full. Rejoin an existing seat.',
      );
    if (existing) existing.connected = false;
    else {
      this.snapshot.members.push({
        id: answer.guest,
        name: answer.name,
        connected: false,
      });
      if (this.snapshot.members.length > this.snapshot.wins.length)
        this.snapshot.wins.push(0);
    }
    peer.accepted = true;
    await peer.pc.setRemoteDescription(answer.description);
    peer.timer = setTimeout(() => {
      if (peer.channel?.readyState !== 'open') {
        this.issue =
          'Could not reach your guest. Try another network, then create a fresh reconnect invitation.';
        this.emit();
      }
    }, 20000);
    this.issue = 'Connecting to your guest…';
    this.checkpoint();
    this.emit();
  }
  start(
    gameId: RoomGameId = this.snapshot?.cardMatch?.gameId ??
      this.snapshot?.match?.gameId ??
      'tictactoe',
  ) {
    const s = this.snapshot;
    if (
      this.role !== 'host' ||
      !s ||
      s.members.length < 2 ||
      !s.members.every((m) => m.connected)
    )
      throw new Error('Wait for all players to connect.');
    if (
      !['tictactoe', 'connect-four', 'crazy-eights', 'uno'].includes(gameId) ||
      (gameId !== 'uno' && s.members.length !== 2)
    )
      throw new Error(
        'Choose UNO-inspired for a table with more than two players.',
      );
    const round = (s.cardMatch?.round ?? s.match?.round ?? -1) + 1;
    if (gameId === 'crazy-eights' || gameId === 'uno') {
      this.privateGame = newCards(gameId, s.members.length);
      s.match = null;
      s.cardMatch = {
        gameId,
        round,
        revision: 0,
        view: cardView(this.privateGame, 0),
      };
    } else {
      this.privateGame = null;
      s.cardMatch = null;
      s.match = {
        mode: 'pvp',
        board: gameId === 'connect-four' ? Array(42).fill(0) : emptyBoard(),
        gameId,
        current: 1,
        over: false,
        round,
        revision: 0,
      };
    }
    this.publish();
  }
  move(cell: number) {
    const s = this.snapshot?.match;
    if (!s) return;
    if (this.role === 'host')
      this.commitMove(this.peerId, cell, s.round, s.revision);
    else {
      const peer = this.peers.values().next().value;
      if (peer)
        this.send(
          { type: 'move', cell, round: s.round, revision: s.revision },
          peer,
        );
    }
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
      s.revision !== revision ||
      !Number.isInteger(cell) ||
      cell < 0 ||
      cell >= (s.gameId === 'connect-four' ? 7 : 9)
    )
      return;
    let next: LocalState;
    try {
      if (s.gameId === 'connect-four') next = c4Drop(s, cell);
      else {
        const result = applyMove(s.board, s.current, cell);
        next = {
          mode: 'pvp',
          board: result.board,
          current: result.current,
          over: result.finished,
        };
      }
    } catch {
      return;
    }
    room.match = { ...s, ...next, mode: 'pvp', revision: s.revision + 1 };
    if (next.over) {
      const win =
        s.gameId === 'connect-four' ? c4Win(next.board) : findWin(next.board);
      if (win) room.wins[next.current - 1]++;
      else room.draws++;
    }
    this.publish();
  }
  cardAction(action: unknown) {
    const s = this.snapshot?.cardMatch;
    if (!s) return;
    if (this.role === 'host')
      this.commitCard(this.peerId, action, s.round, s.revision);
    else {
      const peer = this.peers.values().next().value;
      if (peer)
        this.send(
          { type: 'card-action', action, round: s.round, revision: s.revision },
          peer,
        );
    }
  }
  private commitCard(
    sender: string,
    action: unknown,
    round: number,
    revision: number,
  ) {
    const room = this.snapshot,
      match = room?.cardMatch;
    if (
      !room ||
      !match ||
      !this.privateGame ||
      !room.members.every((m) => m.connected) ||
      match.round !== round ||
      match.revision !== revision
    )
      return;
    const seat = room.members.findIndex((m) => m.id === sender);
    if (seat < 0) return;
    const next = applyCards(this.privateGame, action, seat);
    if (!next) return;
    this.privateGame = next;
    match.revision++;
    match.view = cardView(next, 0);
    if (finishedCards(next)) {
      const winner = match.view.winner;
      if (winner === null || winner === -1) room.draws++;
      else room.wins[winner]++;
    }
    this.publish();
  }
  leave() {
    this.disconnectTransport();
    this.role = null;
    this.peerId = '';
    this.snapshot = null;
    this.privateGame = null;
    this.issue = '';
    this.pendingGuest = '';
    try {
      sessionStorage.removeItem(BACKUP);
      sessionStorage.removeItem(OLD_BACKUP);
    } catch {
      /* No stored room. */
    }
    this.emit();
  }
}
