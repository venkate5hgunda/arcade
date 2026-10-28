export type Good = 'timber' | 'clay' | 'grain' | 'wool' | 'ore';
export type Goods = Record<Good, number>;
export type Development =
  | 'knight'
  | 'victory'
  | 'roads'
  | 'plenty'
  | 'monopoly';
export interface BoardOptions {
  hotTouch: boolean;
  coldTouch: boolean;
  sameNumberTouch: boolean;
  sameResourceTouch: boolean;
  imageStyle: 'illustrated' | 'colorblock';
}
export interface IslandTile {
  q: number;
  row: number;
  terrain: string;
  number: number | null;
  vertices: number[];
}
export interface IslandVertex {
  x: number;
  y: number;
  tiles: number[];
  edges: number[];
  neighbors: number[];
  port: Good | 'any' | null;
}
export interface IslandEdge {
  a: number;
  b: number;
  tiles: number[];
  port: Good | 'any' | null;
}
export interface IslandBoard {
  tiles: IslandTile[];
  vertices: IslandVertex[];
  edges: IslandEdge[];
}
export interface IslandPlayer {
  goods: Goods;
  dev: { type: Development; bought: number }[];
  roads: number;
  settlements: number;
  cities: number;
  knights: number;
}
export interface IslandOffer {
  from: number;
  to: number;
  give: Partial<Goods>;
  want: Partial<Goods>;
}
export interface IslandState {
  board: IslandBoard;
  portMode: 'fixed' | 'shuffled';
  boardOptions: BoardOptions;
  buildings: ({ owner: number; city: boolean } | null)[];
  roads: (number | null)[];
  players: IslandPlayer[];
  bank: Goods;
  deck: Development[];
  robber: number;
  current: number;
  setupStep: number;
  setupVertex: number | null;
  phase: IslandPhase;
  setupRolls: (number | null)[];
  setupOrder: number[] | null;
  rolled: number[] | null;
  discards: number[];
  robberReturn: 'roll' | 'main';
  freeRoads: number;
  devPlayed: boolean;
  turn: number;
  longest: number | null;
  largest: number | null;
  offer: IslandOffer | null;
  roadsReturn: 'roll' | 'main';
  winner: number | null;
  message: string;
}
export type IslandPhase =
  | 'setup-roll'
  | 'setup-settlement'
  | 'setup-road'
  | 'roll'
  | 'discard'
  | 'robber'
  | 'main'
  | 'free-roads';
export interface IslandView
  extends Omit<IslandState, 'players' | 'deck' | 'roadsReturn'> {
  goods: Goods;
  dev: IslandPlayer['dev'];
  counts: (Omit<IslandPlayer, 'goods' | 'dev'> & {
    goods: number;
    dev: number;
  })[];
  deckCount: number;
  scores: number[];
  myScore: number;
}
export interface IslandAction {
  type: string;
  dice?: number[];
  vertex?: number;
  edge?: number;
  tile?: number;
  victim?: number | null;
  goods?: Partial<Goods>;
  good?: Good;
  give?: Good | Partial<Goods>;
  receive?: Good;
  quantity?: number;
  to?: number;
  want?: Partial<Goods>;
  card?: Development;
}
export const GOODS: Good[];
export const COLORS: string[];
export const COSTS: Record<string, Partial<Goods>>;
export const DEFAULT_BOARD_OPTIONS: BoardOptions;
export function createIsland(
  random?: () => number,
  portMode?: 'fixed' | 'shuffled',
  options?: BoardOptions,
): IslandBoard;
export function newCatan(
  count?: number,
  random?: () => number,
  portMode?: 'fixed' | 'shuffled',
  options?: BoardOptions,
): IslandState;
export function validCatanCheckpoint(
  state: unknown,
  allowFinished?: boolean,
): boolean;
export function actCatan(
  state: IslandState,
  action: IslandAction,
  actor?: number,
  random?: () => number,
): boolean;
export function actTradeReply(
  state: IslandState,
  action: IslandAction,
  actor: number,
): boolean;
export function catanView(state: IslandState, player: number): IslandView;
export function canSettle(
  state: Pick<IslandState, 'board' | 'buildings' | 'roads'>,
  player: number,
  vertex: number,
  setup?: boolean,
): boolean;
export function canRoad(
  state: Pick<IslandState, 'board' | 'buildings' | 'roads' | 'setupVertex'>,
  player: number,
  edge: number,
  setup?: boolean,
): boolean;
export function longestRoad(state: IslandState, player: number): number;
export function points(state: IslandState, player: number): number;
export function tradeRate(
  state: Pick<IslandState, 'board' | 'buildings'>,
  player: number,
  good: Good,
): number;
