export interface BusinessOptions {
  startingCash: number;
  salary: number;
  jailFine: number;
  incomeTax: number;
  cityLevy: number;
  rollToStart: boolean;
  jackpot: boolean;
  exactStartBonus: boolean;
  auctionOnly: boolean;
  turnLimit: number;
}
export interface BusinessSpace {
  id: number;
  kind: string;
  name: string;
  group?: string;
  price?: number;
  cost?: number;
  rent?: number[];
}
export interface BusinessPlayer {
  cash: number;
  position: number;
  jailed: boolean;
  attempts: number;
  cards: ('fortune' | 'fund')[];
  out: boolean;
  started: boolean;
}
export interface BusinessDeed {
  owner: number | null;
  level: number;
  mortgaged: boolean;
}
export interface BusinessAuction {
  kind: 'deed' | 'house' | 'hotel';
  id: number | null;
  active: boolean[];
  next: number;
  bid: number;
  bidder: number | null;
  returnPhase: string;
}
export interface BusinessOffer {
  from: number;
  to: number;
  offered: number[];
  wanted: number[];
  cashOut: number;
  cashIn: number;
  cardsOut: number;
  cardsIn: number;
  interestFrom: number;
  interestTo: number;
}
export interface BusinessDebt {
  from: number;
  to: number | null;
  amount: number;
}
export interface BusinessPublic {
  version: number;
  options: BusinessOptions;
  players: BusinessPlayer[];
  deeds: Record<number, BusinessDeed>;
  houses: number;
  hotels: number;
  current: number;
  phase: 'roll' | 'buy' | 'auction' | 'award' | 'debt' | 'finish' | 'win';
  dice: number[] | null;
  doubles: number;
  turns: number;
  queue: object[];
  auction: BusinessAuction | null;
  offer: BusinessOffer | null;
  debt: BusinessDebt | null;
  jackpot: number;
  winner: number | null;
  winners: number[] | null;
  revision: number;
  message: string;
  log: string[];
}
export interface BusinessState extends BusinessPublic {
  decks: Record<string, { draw: number[]; discard: number[] }>;
}
export interface BusinessAction {
  type: string;
  id?: number;
  kind?: 'house' | 'hotel';
  amount?: number;
  group?: string;
  to?: number;
  offered?: number[];
  wanted?: number[];
  cashOut?: number;
  cashIn?: number;
  cardsOut?: number;
  cardsIn?: number;
  card?: 'fortune' | 'fund';
  dice?: number[];
}
export const GROUPS: Record<
  string,
  { color: string; cost: number; names: string[]; prices: number[] }
>;
export const BOARD: BusinessSpace[];
export const DEEDS: number[];
export const DEFAULT_OPTIONS: BusinessOptions;
export const CARDS: Record<string, (string | number)[][]>;
export function createBusiness(
  count?: number,
  options?: Partial<BusinessOptions>,
  random?: () => number,
): BusinessState;
export function publicBusiness(s: BusinessState): BusinessPublic;
export function validBusiness(
  s: unknown,
  count?: number | null,
  options?: { publicView?: boolean },
): boolean;
export function actors(s: BusinessPublic): number[];
export function rent(s: BusinessPublic, id: number, dice?: number): number;
export function netWorth(s: BusinessPublic, player: number): number;
export function actBusiness(
  s: BusinessState,
  action: BusinessAction,
  actor: number,
  random?: () => number,
): BusinessState;
