// Trumpf-Reihenfolge, Bedienpflicht und Stichauswertung.

import { type Card, type Suit, faceOf, rankOf, suitOf } from './cards.ts';
import type { DulleRule, SoloType } from './settings.ts';

/** 'normal' gilt für Normalspiel, Hochzeit, Armut und stilles Solo (entspricht dem Karo-Solo). */
export type TrumpMode = 'normal' | SoloType;

export interface TrickContext {
  mode: TrumpMode;
  /** Beide Karo-Asse bei einem Spieler und Schweinchen-Regel aktiv: Die Karo-Asse sind höchster Trumpf. */
  schweinchen: boolean;
  dulleRule: DulleRule;
}

const QUEENS = ['C-Q', 'S-Q', 'H-Q', 'D-Q'];
const JACKS = ['C-J', 'S-J', 'H-J', 'D-J'];
const FEHL_ORDER = ['A', '10', 'K', 'Q', 'J', '9'];

const SOLO_SUIT: Partial<Record<TrumpMode, Suit>> = {
  normal: 'D',
  diamonds: 'D',
  hearts: 'H',
  spades: 'S',
  clubs: 'C',
};

const trumpCache = new Map<string, string[]>();

/** Trumpf-Karten (ohne Kopie-Index), von hoch nach niedrig. */
export function trumpOrder(mode: TrumpMode, schweinchen = false): string[] {
  const key = `${mode}|${schweinchen}`;
  const cached = trumpCache.get(key);
  if (cached) return cached;

  let order: string[];
  if (mode === 'queens') order = [...QUEENS];
  else if (mode === 'jacks') order = [...JACKS];
  else if (mode === 'fleischlos') order = [];
  else {
    const suit = SOLO_SUIT[mode]!;
    const suitCards = ['A', '10', 'K', '9'].map((r) => `${suit}-${r}`).filter((f) => f !== 'H-10');
    order = ['H-10', ...QUEENS, ...JACKS, ...suitCards];
    if (schweinchen && suit === 'D') order = ['D-A', ...order.filter((f) => f !== 'D-A')];
  }
  trumpCache.set(key, order);
  return order;
}

export function isTrump(card: Card, ctx: Pick<TrickContext, 'mode' | 'schweinchen'>): boolean {
  return trumpOrder(ctx.mode, ctx.schweinchen).includes(faceOf(card));
}

/** 'T' für Trumpf, sonst die Fehlfarbe. */
export function effectiveSuit(card: Card, ctx: Pick<TrickContext, 'mode' | 'schweinchen'>): Suit | 'T' {
  return isTrump(card, ctx) ? 'T' : suitOf(card);
}

/** Stärke innerhalb der eigenen Klasse (Trumpf oder Fehlfarbe). Höher ist besser. */
export function cardPower(card: Card, ctx: Pick<TrickContext, 'mode' | 'schweinchen'>): number {
  const order = trumpOrder(ctx.mode, ctx.schweinchen);
  const ti = order.indexOf(faceOf(card));
  if (ti >= 0) return 1000 - ti;
  return 100 - FEHL_ORDER.indexOf(rankOf(card));
}

export function countTrumps(hand: Card[], ctx: Pick<TrickContext, 'mode' | 'schweinchen'>): number {
  return hand.filter((c) => isTrump(c, ctx)).length;
}

/** Karten, die gespielt werden dürfen (Bedienpflicht). */
export function legalCards(hand: Card[], trick: Card[], ctx: Pick<TrickContext, 'mode' | 'schweinchen'>): Card[] {
  if (trick.length === 0) return [...hand];
  const led = effectiveSuit(trick[0], ctx);
  const follow = hand.filter((c) => effectiveSuit(c, ctx) === led);
  return follow.length > 0 ? follow : [...hand];
}

/** Index der Karte, die den Stich gewinnt. */
export function trickWinnerIndex(cards: Card[], ctx: TrickContext, isLastTrick: boolean): number {
  const led = effectiveSuit(cards[0], ctx);
  let best = 0;
  for (let i = 1; i < cards.length; i++) {
    const c = cards[i];
    const b = cards[best];
    const ec = effectiveSuit(c, ctx);
    const eb = effectiveSuit(b, ctx);
    if (ec === 'T' && eb !== 'T') {
      best = i;
      continue;
    }
    if (ec !== eb || (ec !== 'T' && ec !== led)) continue;
    const pc = cardPower(c, ctx);
    const pb = cardPower(b, ctx);
    if (pc > pb) best = i;
    else if (pc === pb && faceOf(c) === 'H-10' && ec === 'T') {
      if (ctx.dulleRule === 'second' || (ctx.dulleRule === 'secondInLastTrick' && isLastTrick)) best = i;
    }
  }
  return best;
}

const DISPLAY_SUIT_ORDER: Suit[] = ['C', 'H', 'S', 'D'];

/** Sortiert eine Hand für die Anzeige: Trümpfe zuerst (hoch nach niedrig), dann Fehlfarben. */
export function sortHand(hand: Card[], ctx: Pick<TrickContext, 'mode' | 'schweinchen'>): Card[] {
  const key = (c: Card) => {
    const es = effectiveSuit(c, ctx);
    const group = es === 'T' ? 0 : 1 + DISPLAY_SUIT_ORDER.indexOf(es);
    return group * 10000 + (5000 - cardPower(c, ctx)) * 2 + Number(c.split('-')[2]);
  };
  return [...hand].sort((a, b) => key(a) - key(b));
}
