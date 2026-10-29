import { recordStanding, validStandings } from './standings.ts';
import type { Standings, RoomGame } from './standings.ts';
import {
  newCatan,
  catanView,
  actCatan,
  actTradeReply,
  validCatanCheckpoint,
} from '../catan-core.js';
import type { IslandState, IslandView, BoardOptions } from '../catan-core.js';
import { validIslandMove, validIslandView } from '../catan.ts';
import {
  createBusiness,
  publicBusiness,
  validBusiness,
  actBusiness,
} from '../business-core.js';
import type {
  BusinessState,
  BusinessPublic,
  BusinessOptions,
} from '../business-core.js';
import { validBusinessMove } from '../business.ts';
import {
  newMafia,
  validMafia,
  validMafiaView,
  viewFor,
  actMafia,
  resolveMafia,
} from '../mafia.ts';
import type { MafiaState, MafiaView } from '../mafia.ts';
import { newChess, validChess, moveChess, chessResult } from '../chess.ts';
import type { ChessState } from '../chess.ts';
import {
  newRpsRoom,
  validRpsRoom,
  rpsView,
  validRpsView,
  applyRpsRoom,
  revealRpsRoom,
  rpsRoomDone,
} from '../rps.ts';
import type { RpsRoomState, RpsView } from '../rps.ts';
import { applyRace, newRace, raceCount, validRace } from '../races.ts';
import type { RaceId, RaceState } from '../races.ts';
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
  spectators?: Member[];
  spectatorWins?: number[];
  nextRound?: number;
  match: Match | null;
  cardMatch?: CardMatch | null;
  raceMatch?: RaceMatch | null;
  rpsMatch?: RpsMatch | null;
  chessMatch?: ChessMatch | null;
  mafiaMatch?: MafiaMatch | null;
  businessMatch?: BusinessMatch | null;
  islandMatch?: IslandMatch | null;
  standings?: Standings;
  wins: number[];
  draws: number;
}
export type RoomGameId =
  | 'tictactoe'
  | 'connect-four'
  | 'catan'
  | 'business'
  | 'mafia'
  | 'chess'
  | 'rps'
  | CardGameId
  | RaceId;
export interface IslandMatch {
  gameId: 'catan';
  round: number;
  revision: number;
  seat: number;
  view: IslandView;
}
export interface BusinessMatch {
  gameId: 'business';
  round: number;
  revision: number;
  view: BusinessPublic;
}
export interface MafiaMatch {
  gameId: 'mafia';
  round: number;
  revision: number;
  seat: number;
  view: MafiaView;
}
export interface ChessMatch {
  gameId: 'chess';
  round: number;
  revision: number;
  game: ChessState;
}
export interface RpsMatch {
  gameId: 'rps';
  round: number;
  revision: number;
  view: RpsView;
}
export interface RaceMatch {
  gameId: RaceId;
  round: number;
  revision: number;
  race: RaceState;
}
export interface CardMatch {
  gameId: CardGameId;
  round: number;
  revision: number;
  view: CardView;
}
interface Signal {
  version: 9;
  kind: 'offer' | 'answer';
  roomId: string;
  host: string;
  guest: string;
  name: string;
  spectating: boolean;
  description: RTCSessionDescriptionInit;
}
const BACKUP = 'arcade:redesign:room:v9';
const STANDINGS_BACKUP = 'arcade:redesign:room:v8';
const ISLAND_BACKUP = 'arcade:redesign:room:v7';
const BUSINESS_BACKUP = 'arcade:redesign:room:v6';
const MAFIA_BACKUP = 'arcade:redesign:room:v5';
const DUEL_BACKUP = 'arcade:redesign:room:v4';
const RACE_BACKUP = 'arcade:redesign:room:v3';
const CARD_BACKUP = 'arcade:redesign:room:v2';
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

const validMembers = (members: Member[]) =>
  Array.isArray(members) &&
  members.every(
    (m) =>
      m &&
      Object.keys(m).length === 3 &&
      validId(m.id) &&
      validName(m.name) &&
      typeof m.connected === 'boolean',
  );
export function validSnapshot(value: unknown): value is RoomSnapshot {
  const s = value as RoomSnapshot;
  return (
    !!s &&
    typeof s === 'object' &&
    Object.keys(s).every((k) =>
      [
        'roomId',
        'members',
        'spectators',
        'spectatorWins',
        'nextRound',
        'match',
        'cardMatch',
        'raceMatch',
        'rpsMatch',
        'chessMatch',
        'mafiaMatch',
        'businessMatch',
        'islandMatch',
        'standings',
        'wins',
        'draws',
      ].includes(k),
    ) &&
    validId(s.roomId) &&
    Array.isArray(s.members) &&
    s.members.length >= 1 &&
    s.members.length <= 20 &&
    validMembers(s.members) &&
    (s.spectators === undefined ||
      (validMembers(s.spectators) && s.spectators.length <= 20)) &&
    (s.spectatorWins === undefined
      ? !s.spectators?.length
      : Array.isArray(s.spectatorWins) &&
        s.spectatorWins.length === (s.spectators?.length ?? 0) &&
        s.spectatorWins.every(integer)) &&
    (s.nextRound === undefined || integer(s.nextRound)) &&
    new Set([...s.members, ...(s.spectators ?? [])].map((m) => m.id)).size ===
      s.members.length + (s.spectators?.length ?? 0) &&
    Array.isArray(s.wins) &&
    s.wins.length === Math.max(2, s.members.length) &&
    s.wins.every(integer) &&
    integer(s.draws) &&
    (s.standings === undefined ||
      validStandings(
        s.standings,
        [...s.members, ...(s.spectators ?? [])].map((m) => m.id),
      )) &&
    (s.islandMatch == null ||
      (!s.match &&
        !s.cardMatch &&
        !s.raceMatch &&
        !s.rpsMatch &&
        !s.chessMatch &&
        !s.mafiaMatch &&
        !s.businessMatch &&
        s.members.length >= 3 &&
        s.members.length <= 4 &&
        Object.keys(s.islandMatch).length === 5 &&
        s.islandMatch.gameId === 'catan' &&
        integer(s.islandMatch.round) &&
        integer(s.islandMatch.revision) &&
        (s.islandMatch.seat === -1 || integer(s.islandMatch.seat)) &&
        s.islandMatch.seat < s.members.length &&
        validIslandView(s.islandMatch.view, s.members.length) &&
        (s.islandMatch.seat !== -1 ||
          (!s.islandMatch.view.dev.length &&
            s.islandMatch.view.myScore === 0 &&
            Object.values(s.islandMatch.view.goods).every((n) => n === 0))))) &&
    (s.businessMatch == null ||
      (!s.match &&
        !s.cardMatch &&
        !s.raceMatch &&
        !s.rpsMatch &&
        !s.chessMatch &&
        !s.mafiaMatch &&
        s.members.length >= 2 &&
        s.members.length <= 6 &&
        Object.keys(s.businessMatch).length === 4 &&
        s.businessMatch.gameId === 'business' &&
        integer(s.businessMatch.round) &&
        integer(s.businessMatch.revision) &&
        s.businessMatch.view?.revision === s.businessMatch.revision &&
        validBusiness(s.businessMatch.view, s.members.length, {
          publicView: true,
        }))) &&
    (s.mafiaMatch == null ||
      (!s.match &&
        !s.cardMatch &&
        !s.raceMatch &&
        !s.rpsMatch &&
        !s.chessMatch &&
        s.members.length >= 5 &&
        s.members.length <= 10 &&
        Object.keys(s.mafiaMatch).length === 5 &&
        s.mafiaMatch.gameId === 'mafia' &&
        integer(s.mafiaMatch.round) &&
        integer(s.mafiaMatch.revision) &&
        s.mafiaMatch.revision === s.mafiaMatch.view?.revision &&
        validMafiaView(
          s.mafiaMatch.view,
          s.members.length,
          s.mafiaMatch.seat,
        ))) &&
    (s.chessMatch == null ||
      (!s.match &&
        !s.cardMatch &&
        !s.raceMatch &&
        !s.rpsMatch &&
        s.members.length === 2 &&
        Object.keys(s.chessMatch).length === 4 &&
        s.chessMatch.gameId === 'chess' &&
        integer(s.chessMatch.round) &&
        integer(s.chessMatch.revision) &&
        !!s.chessMatch.game &&
        s.chessMatch.game.mode === 'pvp' &&
        validChess(s.chessMatch.game, true))) &&
    (s.rpsMatch == null ||
      (!s.match &&
        !s.cardMatch &&
        !s.raceMatch &&
        s.members.length === 2 &&
        Object.keys(s.rpsMatch).length === 4 &&
        s.rpsMatch.gameId === 'rps' &&
        integer(s.rpsMatch.round) &&
        integer(s.rpsMatch.revision) &&
        validRpsView(s.rpsMatch.view))) &&
    (s.raceMatch == null ||
      (!s.match &&
        !s.cardMatch &&
        Object.keys(s.raceMatch).length === 4 &&
        integer(s.raceMatch.round) &&
        integer(s.raceMatch.revision) &&
        validRace(s.raceMatch.race, true) &&
        s.raceMatch.gameId === s.raceMatch.race.gameId &&
        raceCount(s.raceMatch.race) === s.members.length)) &&
    (s.cardMatch == null ||
      (!s.match &&
        !s.raceMatch &&
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
    if (s && typeof s === 'object' && s.version !== 9)
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
      typeof s.spectating !== 'boolean' ||
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
  spectating: boolean;
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
  private privateRps: RpsRoomState | null = null;
  private privateMafia: MafiaState | null = null;
  private privateBusiness: BusinessState | null = null;
  private privateIsland: IslandState | null = null;
  private rpsTimer?: ReturnType<typeof setTimeout>;
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
          privateRps: this.privateRps,
          privateMafia: this.privateMafia,
          privateBusiness: this.privateBusiness,
          privateIsland: this.privateIsland,
        }),
      );
    } catch {
      this.issue = 'Room recovery cannot be saved. Keep this tab open.';
    }
  }
  restore() {
    if (this.role) return;
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(BACKUP) ??
          sessionStorage.getItem(STANDINGS_BACKUP) ??
          sessionStorage.getItem(ISLAND_BACKUP) ??
          sessionStorage.getItem(BUSINESS_BACKUP) ??
          sessionStorage.getItem(MAFIA_BACKUP) ??
          sessionStorage.getItem(DUEL_BACKUP) ??
          sessionStorage.getItem(RACE_BACKUP) ??
          sessionStorage.getItem(CARD_BACKUP) ??
          'null',
      );
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
      if (
        snapshot.rpsMatch &&
        (!validRpsRoom(saved?.privateRps) ||
          JSON.stringify(rpsView(saved.privateRps, 0)) !==
            JSON.stringify(snapshot.rpsMatch.view))
      )
        return;
      if (
        snapshot.mafiaMatch &&
        (!validMafia(saved?.privateMafia, snapshot.members.length) ||
          snapshot.mafiaMatch.seat !== 0 ||
          JSON.stringify(viewFor(saved.privateMafia, 0)) !==
            JSON.stringify(snapshot.mafiaMatch.view))
      )
        return;
      if (
        snapshot.businessMatch &&
        (!validBusiness(saved?.privateBusiness, snapshot.members.length) ||
          JSON.stringify(publicBusiness(saved.privateBusiness)) !==
            JSON.stringify(snapshot.businessMatch.view))
      )
        return;
      if (
        snapshot.islandMatch &&
        (!validCatanCheckpoint(saved?.privateIsland, true) ||
          saved.privateIsland.players.length !== snapshot.members.length ||
          snapshot.islandMatch.seat !== 0 ||
          JSON.stringify(catanView(saved.privateIsland, 0)) !==
            JSON.stringify(snapshot.islandMatch.view))
      )
        return;
      this.privateIsland = snapshot.islandMatch
        ? structuredClone(saved.privateIsland)
        : null;
      this.privateBusiness = snapshot.businessMatch
        ? structuredClone(saved.privateBusiness)
        : null;
      this.privateMafia = snapshot.mafiaMatch
        ? structuredClone(saved.privateMafia)
        : null;
      this.privateRps = snapshot.rpsMatch
        ? structuredClone(saved.privateRps)
        : null;
      this.snapshot = structuredClone(snapshot);
      this.privateGame = snapshot.cardMatch
        ? structuredClone(saved.privateGame)
        : null;
      this.role = 'host';
      this.peerId = snapshot.members[0].id;
      this.snapshot.members.forEach((m, i) => (m.connected = i === 0));
      this.snapshot.spectators?.forEach((m) => (m.connected = false));
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
      spectators: [],
      spectatorWins: [],
      nextRound: 0,
      wins: [0, 0],
      draws: 0,
      standings: { players: [], recorded: [] },
    };
    this.checkpoint();
    this.emit();
  }
  private allMembers() {
    return [
      ...(this.snapshot?.members ?? []),
      ...(this.snapshot?.spectators ?? []),
    ];
  }
  private activeMatch() {
    const s = this.snapshot;
    return (
      s?.islandMatch ??
      s?.businessMatch ??
      s?.mafiaMatch ??
      s?.chessMatch ??
      s?.rpsMatch ??
      s?.raceMatch ??
      s?.cardMatch ??
      s?.match
    );
  }
  setSpectating(id: string, spectating: boolean) {
    const s = this.snapshot;
    if (this.role !== 'host' || !s || this.activeMatch() || id === this.peerId)
      throw Error('Choose guest seats in the lobby. The host must play.');
    s.spectators ??= [];
    s.spectatorWins ??= [];
    const source = spectating ? s.members : s.spectators;
    const index = source.findIndex((m) => m.id === id);
    if (index < 0) return;
    if ((spectating ? s.spectators.length : s.members.length) >= 20)
      throw Error('That roster already has 20 seats.');
    const [member] = source.splice(index, 1);
    if (spectating) {
      const [wins] = s.wins.splice(index, 1);
      s.spectators.push(member);
      s.spectatorWins.push(wins);
    } else {
      const [wins] = s.spectatorWins.splice(index, 1);
      s.members.push(member);
      s.wins[s.members.length - 1] = wins;
    }
    s.wins.length = Math.max(2, s.members.length);
    for (let i = 0; i < s.wins.length; i++) s.wins[i] ??= 0;
    const peer = this.peers.get(id);
    if (peer) peer.spectating = spectating;
    this.publish();
  }
  returnLobby() {
    if (this.role !== 'host' || !this.snapshot)
      throw Error('Only the host can return to the lobby.');
    clearTimeout(this.rpsTimer);
    const s = this.snapshot;
    s.nextRound = Math.max(
      s.nextRound ?? 0,
      (this.activeMatch()?.round ?? -1) + 1,
    );
    s.match = null;
    s.cardMatch = null;
    s.raceMatch = null;
    s.rpsMatch = null;
    s.chessMatch = null;
    s.mafiaMatch = null;
    s.businessMatch = null;
    s.islandMatch = null;
    this.privateGame = null;
    this.privateRps = null;
    this.privateMafia = null;
    this.privateBusiness = null;
    this.privateIsland = null;
    this.publish();
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
      spectating: false,
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
    this.allMembers().forEach((m) => {
      if (this.role === 'guest' ? m.id !== this.peerId : m.id === id)
        m.connected = false;
    });
    this.issue =
      this.role === 'host' && this.snapshot.spectators?.some((m) => m.id === id)
        ? 'A spectator disconnected. Players can keep playing.'
        : 'Connection lost. Keep the tabs open; the host can send a reconnect invitation.';
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
            name: this.allMembers().find((m) => m.id === this.peerId)?.name,
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
        version: 9,
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
    if (snapshot.rpsMatch && this.privateRps)
      snapshot.rpsMatch.view = rpsView(this.privateRps, seat);
    if (snapshot.mafiaMatch && this.privateMafia) {
      snapshot.mafiaMatch.seat = seat;
      snapshot.mafiaMatch.view = viewFor(this.privateMafia, seat);
    }
    if (snapshot.islandMatch && this.privateIsland) {
      snapshot.islandMatch.seat = seat;
      snapshot.islandMatch.view = catanView(
        this.privateIsland,
        Math.max(0, seat),
      );
      if (seat === -1) {
        snapshot.islandMatch.view.goods = {
          timber: 0,
          clay: 0,
          wool: 0,
          grain: 0,
          ore: 0,
        };
        snapshot.islandMatch.view.dev = [];
        snapshot.islandMatch.view.myScore = 0;
      }
    }
    return snapshot;
  }
  private publish() {
    this.scheduleRps();
    this.checkpoint();
    if (this.snapshot)
      for (const peer of this.peers.values()) {
        const seat = this.snapshot.members.findIndex((m) => m.id === peer.id);
        if (
          peer.accepted &&
          (seat > 0 ||
            this.snapshot.spectators?.some((m) => m.id === peer.id)) &&
          peer.channel?.readyState === 'open'
        )
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
      m.version !== 9 ||
      m.roomId !== this.snapshot.roomId ||
      m.sender !== peer.id ||
      !integer(m.sequence) ||
      m.sequence <= peer.received
    )
      throw new Error();
    peer.received = m.sequence;
    if (this.role === 'host') {
      if (
        !['hello', 'sync'].includes(m.type) &&
        this.snapshot.spectators?.some((p) => p.id === peer.id)
      )
        return;
      if (m.type === 'hello' && peer.accepted && validName(m.name)) {
        const guest = this.allMembers().find((member) => member.id === peer.id);
        if (!guest || guest.name !== m.name) throw new Error();
        guest.connected = true;
        this.issue = '';
        this.publish();
      } else if (m.type === 'move' && peer.accepted)
        this.commitMove(peer.id, m.cell, m.round, m.revision);
      else if (m.type === 'card-action' && peer.accepted)
        this.commitCard(peer.id, m.action, m.round, m.revision);
      else if (m.type === 'island-action' && peer.accepted)
        this.commitIsland(peer.id, m.action, m.round, m.revision);
      else if (m.type === 'business-action' && peer.accepted)
        this.commitBusiness(peer.id, m.action, m.round, m.revision);
      else if (m.type === 'mafia-action' && peer.accepted)
        this.commitMafia(peer.id, m.action, m.round, m.revision);
      else if (m.type === 'chess-action' && peer.accepted)
        this.commitChess(peer.id, m.action, m.round, m.revision);
      else if (m.type === 'rps-action' && peer.accepted)
        this.commitRps(peer.id, m.action, m.round, m.revision, m.turns);
      else if (m.type === 'race-action' && peer.accepted)
        this.commitRace(peer.id, m.action, m.round, m.revision);
      else if (m.type === 'sync' && peer.accepted) this.publish();
      else throw new Error();
    } else {
      if (
        ['mafia-error', 'business-error', 'island-error'].includes(m.type) &&
        typeof m.message === 'string' &&
        m.message.length <= 200
      ) {
        this.issue = m.message;
        this.emit();
        return;
      }
      if (
        m.type !== 'snapshot' ||
        !validSnapshot(m.snapshot) ||
        m.snapshot.roomId !== this.snapshot.roomId ||
        m.snapshot.members[0].id !== peer.id ||
        !(
          [...m.snapshot.members, ...(m.snapshot.spectators ?? [])] as Member[]
        ).some((member) => member.id === this.peerId) ||
        (m.snapshot.cardMatch &&
          m.snapshot.cardMatch.view.seat !==
            m.snapshot.members.findIndex(
              (member: Member) => member.id === this.peerId,
            ))
      )
        throw new Error();
      if (
        m.snapshot.islandMatch &&
        m.snapshot.islandMatch.seat !==
          m.snapshot.members.findIndex(
            (member: Member) => member.id === this.peerId,
          )
      )
        throw new Error();
      if (
        m.snapshot.mafiaMatch &&
        m.snapshot.mafiaMatch.seat !==
          m.snapshot.members.findIndex(
            (member: Member) => member.id === this.peerId,
          )
      )
        throw new Error();
      if (
        m.snapshot.rpsMatch &&
        m.snapshot.rpsMatch.view.seat !==
          m.snapshot.members.findIndex(
            (member: Member) => member.id === this.peerId,
          )
      )
        throw new Error();
      const previous =
          this.snapshot.islandMatch ??
          this.snapshot.businessMatch ??
          this.snapshot.mafiaMatch ??
          this.snapshot.chessMatch ??
          this.snapshot.rpsMatch ??
          this.snapshot.raceMatch ??
          this.snapshot.cardMatch ??
          this.snapshot.match,
        next =
          (m.snapshot as RoomSnapshot).islandMatch ??
          (m.snapshot as RoomSnapshot).businessMatch ??
          (m.snapshot as RoomSnapshot).mafiaMatch ??
          (m.snapshot as RoomSnapshot).chessMatch ??
          (m.snapshot as RoomSnapshot).rpsMatch ??
          (m.snapshot as RoomSnapshot).raceMatch ??
          (m.snapshot as RoomSnapshot).cardMatch ??
          m.snapshot.match;
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
      !this.allMembers().some((m) => m.id === this.pendingGuest)
    )
      this.closePeer(this.pendingGuest);
    this.pendingGuest = '';
    this.issue = '';
    this.emit();
  }
  async createInvite(guestId?: string, spectating = false): Promise<string> {
    if (this.role !== 'host' || !this.snapshot)
      throw new Error('Create a room first.');
    const existing = guestId
      ? this.allMembers().find((m) => m.id === guestId && m.id !== this.peerId)
      : spectating
        ? this.snapshot.spectators?.find((m) => !m.connected)
        : (this.snapshot.members.slice(1).find((m) => !m.connected) ??
          ((this.snapshot.match ||
            this.snapshot.cardMatch ||
            this.snapshot.raceMatch ||
            this.snapshot.rpsMatch ||
            this.snapshot.chessMatch ||
            this.snapshot.mafiaMatch ||
            this.snapshot.businessMatch ||
            this.snapshot.islandMatch) &&
          this.snapshot.members.length === 2
            ? this.snapshot.members[1]
            : undefined));
    if (existing)
      spectating = !!this.snapshot.spectators?.some(
        (m) => m.id === existing.id,
      );
    if (guestId && !existing)
      throw new Error('Choose an existing guest to reconnect.');
    if (
      !existing &&
      !spectating &&
      (this.snapshot.match ||
        this.snapshot.cardMatch ||
        this.snapshot.raceMatch ||
        this.snapshot.rpsMatch ||
        this.snapshot.chessMatch ||
        this.snapshot.mafiaMatch ||
        this.snapshot.businessMatch ||
        this.snapshot.islandMatch)
    )
      throw new Error('Reconnect an existing seat during a match.');
    if (
      !existing &&
      (spectating
        ? (this.snapshot.spectators?.length ?? 0)
        : this.snapshot.members.length) >= 20
    )
      throw new Error('This table already has 20 players.');
    if (
      this.pendingGuest &&
      !this.allMembers().some((m) => m.id === this.pendingGuest)
    )
      this.closePeer(this.pendingGuest);
    const guest = existing?.id ?? crypto.randomUUID();
    if (existing) existing.connected = false;
    this.pendingGuest = guest;
    const peer = this.connection(guest);
    peer.spectating = spectating;
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
        version: 9,
        kind: 'offer',
        spectating,
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
      standings: { players: [], recorded: [] },
    };
    if (offer.spectating) {
      this.snapshot.spectators = [this.snapshot.members.pop()!];
      this.snapshot.spectatorWins = [0];
    } else {
      this.snapshot.spectators = [];
      this.snapshot.spectatorWins = [];
    }
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
      answer.guest !== peer.id ||
      answer.spectating !== peer.spectating
    )
      throw new Error('This answer does not match the pending invitation.');
    const existing = this.allMembers().find((m) => m.id === answer.guest);
    if (existing && existing.name !== answer.name) {
      this.closePeer(peer.id);
      this.pendingGuest = '';
      throw new Error(
        'Reconnect with the same room name. Create a fresh invitation; your seat and board are preserved.',
      );
    }
    if (
      !existing &&
      !peer.spectating &&
      (this.snapshot.match ||
        this.snapshot.cardMatch ||
        this.snapshot.raceMatch ||
        this.snapshot.rpsMatch ||
        this.snapshot.chessMatch ||
        this.snapshot.mafiaMatch ||
        this.snapshot.businessMatch ||
        this.snapshot.islandMatch ||
        this.snapshot.members.length >= 20)
    )
      throw new Error(
        'The table is already playing or full. Rejoin an existing seat.',
      );
    if (existing) existing.connected = false;
    else if (peer.spectating) {
      this.snapshot.spectators ??= [];
      this.snapshot.spectatorWins ??= [];
      if (this.snapshot.spectators.length >= 20)
        throw Error('This table already has 20 spectators.');
      this.snapshot.spectators.push({
        id: answer.guest,
        name: answer.name,
        connected: false,
      });
      this.snapshot.spectatorWins.push(0);
    } else {
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
    gameId: RoomGameId = this.snapshot?.islandMatch?.gameId ??
      this.snapshot?.businessMatch?.gameId ??
      this.snapshot?.mafiaMatch?.gameId ??
      this.snapshot?.chessMatch?.gameId ??
      this.snapshot?.rpsMatch?.gameId ??
      this.snapshot?.raceMatch?.gameId ??
      this.snapshot?.cardMatch?.gameId ??
      this.snapshot?.match?.gameId ??
      'tictactoe',
    options?:
      | Partial<BusinessOptions>
      | { portMode: 'fixed' | 'shuffled'; boardOptions: BoardOptions },
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
      ![
        'catan',
        'business',
        'mafia',
        'chess',
        'rps',
        'tictactoe',
        'connect-four',
        'crazy-eights',
        'uno',
        'snakes-ladders',
        'ludo',
      ].includes(gameId) ||
      (['chess', 'rps', 'tictactoe', 'connect-four', 'crazy-eights'].includes(
        gameId,
      ) &&
        s.members.length !== 2) ||
      (gameId === 'catan' && (s.members.length < 3 || s.members.length > 4)) ||
      (gameId === 'business' && s.members.length > 6) ||
      (gameId === 'mafia' && (s.members.length < 5 || s.members.length > 10)) ||
      (['snakes-ladders', 'ludo'].includes(gameId) && s.members.length > 4)
    )
      throw new Error('Choose a game that supports this number of players.');
    const nextBusiness =
      gameId === 'business'
        ? createBusiness(
            s.members.length,
            (options as Partial<BusinessOptions>) ??
              s.businessMatch?.view.options ??
              {},
            () => crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000,
          )
        : null;
    const nextIsland =
      gameId === 'catan'
        ? newCatan(
            s.members.length,
            () => crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000,
            (
              options as
                | { portMode: 'fixed' | 'shuffled'; boardOptions: BoardOptions }
                | undefined
            )?.portMode ??
              s.islandMatch?.view.portMode ??
              'fixed',
            (
              options as
                | { portMode: 'fixed' | 'shuffled'; boardOptions: BoardOptions }
                | undefined
            )?.boardOptions ?? s.islandMatch?.view.boardOptions,
          )
        : null;
    const round = Math.max(
      s.nextRound ?? 0,
      (s.islandMatch?.round ??
        s.businessMatch?.round ??
        s.mafiaMatch?.round ??
        s.chessMatch?.round ??
        s.rpsMatch?.round ??
        s.raceMatch?.round ??
        s.cardMatch?.round ??
        s.match?.round ??
        -1) + 1,
    );
    s.nextRound = round + 1;
    this.privateRps = null;
    this.privateMafia = null;
    this.privateBusiness = null;
    this.privateIsland = null;
    s.islandMatch = null;
    s.businessMatch = null;
    s.mafiaMatch = null;
    s.rpsMatch = null;
    s.chessMatch = null;
    if (gameId === 'catan') {
      this.privateGame = null;
      s.match = null;
      s.cardMatch = null;
      s.raceMatch = null;
      this.privateIsland = nextIsland!;
      s.islandMatch = {
        gameId: 'catan',
        round,
        revision: 0,
        seat: 0,
        view: catanView(this.privateIsland, 0),
      };
    } else if (gameId === 'business') {
      this.privateGame = null;
      s.match = null;
      s.cardMatch = null;
      s.raceMatch = null;
      this.privateBusiness = nextBusiness!;
      s.businessMatch = {
        gameId: 'business',
        round,
        revision: 0,
        view: publicBusiness(this.privateBusiness),
      };
    } else if (gameId === 'mafia') {
      this.privateGame = null;
      s.match = null;
      s.cardMatch = null;
      s.raceMatch = null;
      this.privateMafia = newMafia(
        s.members.length,
        () => crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000,
      );
      s.mafiaMatch = {
        gameId: 'mafia',
        round,
        revision: 0,
        seat: 0,
        view: viewFor(this.privateMafia, 0),
      };
    } else if (gameId === 'chess') {
      this.privateGame = null;
      s.match = null;
      s.cardMatch = null;
      s.raceMatch = null;
      s.chessMatch = {
        gameId: 'chess',
        round,
        revision: 0,
        game: newChess('pvp', 'w'),
      };
    } else if (gameId === 'rps') {
      this.privateGame = null;
      s.match = null;
      s.cardMatch = null;
      s.raceMatch = null;
      this.privateRps = newRpsRoom();
      s.rpsMatch = {
        gameId: 'rps',
        round,
        revision: 0,
        view: rpsView(this.privateRps, 0),
      };
    } else if (gameId === 'snakes-ladders' || gameId === 'ludo') {
      this.privateGame = null;
      s.match = null;
      s.cardMatch = null;
      s.raceMatch = {
        gameId,
        round,
        revision: 0,
        race: newRace(gameId, s.members.length),
      };
    } else if (gameId === 'crazy-eights' || gameId === 'uno') {
      s.raceMatch = null;
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
      s.raceMatch = null;
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
  private recordResult(
    gameId: RoomGame,
    round: number,
    winners: number[] | null,
  ) {
    const room = this.snapshot!;
    const prior = room.standings ?? { players: [], recorded: [] };
    const next = recordStanding(
      prior,
      room.members.map((m) => m.id),
      gameId,
      round,
      winners,
    );
    if (next === prior) return;
    room.standings = next;
    if (winners === null) room.draws++;
    else for (const winner of winners) room.wins[winner]++;
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
      this.recordResult(
        s.gameId ?? 'tictactoe',
        s.round,
        win ? [next.current - 1] : null,
      );
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
      this.recordResult(
        match.gameId,
        match.round,
        winner === null || winner === -1 ? null : [winner],
      );
    }
    this.publish();
  }
  raceAction(action: unknown) {
    const match = this.snapshot?.raceMatch;
    if (!match) return;
    if (this.role === 'host')
      this.commitRace(this.peerId, action, match.round, match.revision);
    else {
      const peer = this.peers.values().next().value;
      if (peer)
        this.send(
          {
            type: 'race-action',
            action,
            round: match.round,
            revision: match.revision,
          },
          peer,
        );
    }
  }
  private commitRace(
    sender: string,
    action: unknown,
    round: number,
    revision: number,
  ) {
    const room = this.snapshot,
      match = room?.raceMatch;
    if (
      !room ||
      !match ||
      !room.members.every((m) => m.connected) ||
      match.round !== round ||
      match.revision !== revision
    )
      return;
    const seat = room.members.findIndex((m) => m.id === sender);
    if (seat < 0) return;
    const next = applyRace(match.race, action, seat);
    if (!next) return;
    match.race = next;
    match.revision++;
    if (next.state.winner != null)
      this.recordResult(match.gameId, match.round, [next.state.winner]);
    this.publish();
  }
  islandAction(action: unknown) {
    const match = this.snapshot?.islandMatch;
    if (!match) return;
    if (this.role === 'host')
      this.commitIsland(this.peerId, action, match.round, match.revision);
    else {
      const peer = this.peers.values().next().value;
      if (peer)
        this.send(
          {
            type: 'island-action',
            action,
            round: match.round,
            revision: match.revision,
          },
          peer,
        );
    }
  }
  private commitIsland(
    sender: string,
    action: unknown,
    round: number,
    revision: number,
  ) {
    const room = this.snapshot,
      match = room?.islandMatch,
      state = this.privateIsland;
    if (!room || !match || !state) return;
    const seat = room.members.findIndex((m) => m.id === sender);
    const report = (message: string) => {
      if (seat === 0) {
        this.issue = message;
        this.emit();
      } else {
        const peer = this.peers.get(sender);
        if (peer?.accepted && peer.channel?.readyState === 'open')
          this.send({ type: 'island-error', message }, peer);
      }
    };
    if (seat < 0) return;
    if (match.round !== round || match.revision !== revision) {
      this.publish();
      report('The island changed. Check the latest state and try again.');
      return;
    }
    if (!room.members.every((m) => m.connected) || !validIslandMove(action)) {
      report('Reconnect all navigators and choose a valid action.');
      return;
    }
    const next = structuredClone(state);
    const random = () =>
      crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000;
    const move = ['roll', 'setup-roll'].includes(action.type)
      ? {
          ...action,
          dice: [1 + Math.floor(random() * 6), 1 + Math.floor(random() * 6)],
        }
      : action;
    const ok = ['accept', 'decline'].includes(move.type)
      ? actTradeReply(next, move, seat)
      : actCatan(next, move, seat, random);
    if (!ok || !validCatanCheckpoint(next, true)) {
      report('That island action is unavailable.');
      return;
    }
    this.privateIsland = next;
    match.revision++;
    match.view = catanView(next, 0);
    if (next.winner !== null && state.winner === null)
      this.recordResult('catan', match.round, [next.winner]);
    this.issue = '';
    this.publish();
  }
  businessAction(action: unknown) {
    const s = this.snapshot?.businessMatch;
    if (!s) return;
    if (this.role === 'host')
      this.commitBusiness(this.peerId, action, s.round, s.revision);
    else {
      const peer = this.peers.values().next().value;
      if (peer)
        this.send(
          {
            type: 'business-action',
            action,
            round: s.round,
            revision: s.revision,
          },
          peer,
        );
    }
  }
  private businessError(sender: string, message: string) {
    if (sender === this.peerId) {
      this.issue = message;
      this.emit();
      return;
    }
    const peer = this.peers.get(sender);
    if (peer?.accepted && peer.channel?.readyState === 'open')
      this.send({ type: 'business-error', message }, peer);
  }
  private commitBusiness(
    sender: string,
    action: unknown,
    round: number,
    revision: number,
  ) {
    const room = this.snapshot,
      match = room?.businessMatch,
      state = this.privateBusiness;
    if (
      !room ||
      !match ||
      !state ||
      match.round !== round ||
      match.revision !== revision
    ) {
      if (room) {
        this.publish();
        this.businessError(sender, 'That turn has passed. Choose again.');
      }
      return;
    }
    const seat = room.members.findIndex((m) => m.id === sender);
    if (
      seat < 0 ||
      !room.members[seat].connected ||
      !room.members.every((m, i) => m.connected || state.players[i].out) ||
      !validBusinessMove(action)
    )
      return;
    try {
      const random = () =>
        crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000;
      const next = actBusiness(
        state,
        action.type === 'roll'
          ? {
              ...action,
              dice: [
                1 + Math.floor(random() * 6),
                1 + Math.floor(random() * 6),
              ],
            }
          : action,
        seat,
        random,
      );
      this.privateBusiness = next;
      match.revision = next.revision;
      match.view = publicBusiness(next);
      if (next.phase === 'win' && state.phase !== 'win')
        this.recordResult(
          'business',
          match.round,
          next.winners?.length ? next.winners : null,
        );
      this.issue = '';
      this.publish();
    } catch (error) {
      this.publish();
      this.businessError(
        sender,
        error instanceof Error
          ? error.message.slice(0, 200)
          : 'That action is unavailable.',
      );
    }
  }
  mafiaAction(action: unknown) {
    const s = this.snapshot?.mafiaMatch;
    if (!s) return;
    if (this.role === 'host')
      this.commitMafia(this.peerId, action, s.round, s.revision);
    else {
      const peer = this.peers.values().next().value;
      if (peer)
        this.send(
          {
            type: 'mafia-action',
            action,
            round: s.round,
            revision: s.revision,
          },
          peer,
        );
    }
  }
  private mafiaError(sender: string, message: string) {
    if (sender === this.peerId) {
      this.issue = message;
      this.emit();
      return;
    }
    const peer = this.peers.get(sender);
    if (peer?.accepted && peer.channel?.readyState === 'open')
      this.send({ type: 'mafia-error', message }, peer);
  }
  private commitMafia(
    sender: string,
    action: unknown,
    round: number,
    revision: number,
  ) {
    const room = this.snapshot,
      match = room?.mafiaMatch,
      state = this.privateMafia;
    if (
      !room ||
      !match ||
      !state ||
      match.round !== round ||
      match.revision !== revision
    ) {
      if (room) {
        this.publish();
        this.mafiaError(sender, 'That turn has passed. Choose again.');
      }
      return;
    }
    const seat = room.members.findIndex((m) => m.id === sender),
      a = action as { type?: string; target?: number | null };
    if (
      seat < 0 ||
      !room.members[seat].connected ||
      !a ||
      typeof a !== 'object' ||
      !Object.keys(a).every((k) => ['type', 'target'].includes(k))
    )
      return;
    try {
      let next: MafiaState;
      if (
        a.type === 'mafia-resolve' &&
        seat === 0 &&
        Object.keys(a).length === 1
      )
        next = resolveMafia(state, seat);
      else if (
        a.type === 'mafia-skip' &&
        (typeof a.target !== 'number' ||
          room.members[a.target]?.connected !== false)
      ) {
        this.mafiaError(
          sender,
          'Only disconnected seats can be marked absent.',
        );
        return;
      } else next = actMafia(state, { ...a, revision }, seat);
      this.privateMafia = next;
      match.revision = next.revision;
      match.view = viewFor(next, 0);
      if (next.winner && !state.winner)
        this.recordResult(
          'mafia',
          match.round,
          next.roles.flatMap((role, i) =>
            (role === 'mafia' ? 'mafia' : 'town') === next.winner ? [i] : [],
          ),
        );
      this.issue = '';
      this.publish();
    } catch {
      this.publish();
      this.mafiaError(sender, 'That action is not available to your seat now.');
    }
  }
  chessAction(action: unknown) {
    const s = this.snapshot?.chessMatch;
    if (!s) return;
    if (this.role === 'host')
      this.commitChess(this.peerId, action, s.round, s.revision);
    else {
      const peer = this.peers.values().next().value;
      if (peer)
        this.send(
          {
            type: 'chess-action',
            action,
            round: s.round,
            revision: s.revision,
          },
          peer,
        );
    }
  }
  private commitChess(
    sender: string,
    action: unknown,
    round: number,
    revision: number,
  ) {
    const room = this.snapshot,
      match = room?.chessMatch;
    if (
      !room ||
      !match ||
      !room.members.every((m) => m.connected) ||
      match.round !== round ||
      match.revision !== revision ||
      room.members[match.game.state.turn === 'w' ? 0 : 1]?.id !== sender
    )
      return;
    const a = action as {
      type?: string;
      from?: number;
      to?: number;
      promotion?: unknown;
    };
    if (
      !a ||
      a.type !== 'move' ||
      !Object.keys(a).every((k) =>
        ['type', 'from', 'to', 'promotion'].includes(k),
      ) ||
      !Number.isInteger(a.from) ||
      !Number.isInteger(a.to) ||
      (a.promotion !== undefined &&
        !['q', 'r', 'b', 'n'].includes(a.promotion as string))
    )
      return;
    const next = moveChess(
      match.game,
      a.from!,
      a.to!,
      a.promotion as 'q' | 'r' | 'b' | 'n' | undefined,
    );
    if (!next) return;
    match.game = next;
    match.revision++;
    if (next.over) {
      const result = chessResult(next);
      this.recordResult(
        'chess',
        match.round,
        result.winner ? [result.winner === 'w' ? 0 : 1] : null,
      );
    }
    this.publish();
  }
  rpsAction(action: unknown) {
    const s = this.snapshot?.rpsMatch;
    if (!s) return;
    if (this.role === 'host')
      this.commitRps(this.peerId, action, s.round, s.revision, s.view.turns);
    else {
      const peer = this.peers.values().next().value;
      if (peer)
        this.send(
          {
            type: 'rps-action',
            action,
            round: s.round,
            revision: s.revision,
            turns: s.view.turns,
          },
          peer,
        );
    }
  }
  private commitRps(
    sender: string,
    action: unknown,
    round: number,
    revision: number,
    turns: number,
  ) {
    const room = this.snapshot,
      match = room?.rpsMatch;
    if (
      !room ||
      !match ||
      !this.privateRps ||
      !room.members.every((m) => m.connected) ||
      match.round !== round ||
      turns !== this.privateRps.turns
    )
      return;
    // Independent throws can cross in flight after the other seat locks in.
    // Bind to the throw round as well as the match so an old pick cannot replay.
    const concurrentPick =
      (action as { type?: string })?.type === 'pick' &&
      this.privateRps.phase === 'picking' &&
      this.privateRps.picks.some(Boolean) &&
      revision === match.revision - 1;
    if (match.revision !== revision && !concurrentPick) return;
    const next = applyRpsRoom(
      this.privateRps,
      action,
      room.members.findIndex((m) => m.id === sender),
    );
    if (!next) return;
    this.privateRps = next;
    match.revision++;
    match.view = rpsView(next, 0);
    this.publish();
  }
  private scheduleRps() {
    clearTimeout(this.rpsTimer);
    const room = this.snapshot,
      match = room?.rpsMatch;
    if (
      this.role !== 'host' ||
      !match ||
      !this.privateRps ||
      this.privateRps.phase !== 'countdown' ||
      !room?.members.every((m) => m.connected)
    )
      return;
    this.rpsTimer = setTimeout(
      () => {
        if (!this.privateRps || this.snapshot?.rpsMatch !== match) return;
        const next = revealRpsRoom(this.privateRps);
        if (!next) {
          this.scheduleRps();
          return;
        }
        this.privateRps = next;
        match.revision++;
        match.view = rpsView(next, 0);
        if (rpsRoomDone(next))
          this.recordResult('rps', match.round, [next.score[0] === 3 ? 0 : 1]);
        this.publish();
      },
      Math.max(0, this.privateRps.deadline - Date.now()),
    );
  }
  leave() {
    clearTimeout(this.rpsTimer);
    this.privateRps = null;
    this.privateMafia = null;
    this.privateBusiness = null;
    this.privateIsland = null;
    this.disconnectTransport();
    this.role = null;
    this.peerId = '';
    this.snapshot = null;
    this.privateGame = null;
    this.issue = '';
    this.pendingGuest = '';
    try {
      sessionStorage.removeItem(BACKUP);
      sessionStorage.removeItem(STANDINGS_BACKUP);
      sessionStorage.removeItem(ISLAND_BACKUP);
      sessionStorage.removeItem(BUSINESS_BACKUP);
      sessionStorage.removeItem(MAFIA_BACKUP);
      sessionStorage.removeItem(DUEL_BACKUP);
      sessionStorage.removeItem(RACE_BACKUP);
      sessionStorage.removeItem(CARD_BACKUP);
      sessionStorage.removeItem(OLD_BACKUP);
    } catch {
      /* No stored room. */
    }
    this.emit();
  }
}
