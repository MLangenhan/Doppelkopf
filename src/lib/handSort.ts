import { type Card, type Suit, cardPower, effectiveSuit, faceOf, rankOf, sortHand, suitOf } from '@engine';
import type { HandSort } from './prefs';

type Ctx = Parameters<typeof sortHand>[1];

// Schwarz und Rot im Wechsel, damit die Farben gut auseinanderzuhalten sind
const SUITS: Suit[] = ['C', 'H', 'S', 'D'];
const RANKS = ['A', '10', 'K', 'Q', 'J', '9'];
const copy = (c: Card) => Number(c.split('-')[2]);

/** Eigene Reihenfolge: alle Kartenarten ("H-10", "C-Q", …) in der Wunsch-Reihenfolge, gilt in jedem Spiel */
export type FaceOrder = string[];

/** Ordnet die Hand nach dem gewählten Muster. Bei "custom" gilt die eigene Rangfolge der Kartenarten. */
export function arrangeHand(hand: Card[], ctx: Ctx, mode: HandSort, custom: FaceOrder | null): Card[] {
  if (mode === 'trumpFirst') return sortHand(hand, ctx);
  if (mode === 'trumpLast') {
    const base = sortHand(hand, ctx);
    const trumps = base.filter((c) => effectiveSuit(c, ctx) === 'T').sort((a, b) => cardPower(a, ctx) - cardPower(b, ctx));
    return [...base.filter((c) => effectiveSuit(c, ctx) !== 'T'), ...trumps];
  }
  if (mode === 'suits') {
    const key = (c: Card) => SUITS.indexOf(suitOf(c)) * 100 + RANKS.indexOf(rankOf(c)) * 2 + copy(c);
    return [...hand].sort((a, b) => key(a) - key(b));
  }
  return applyFaceOrder(hand, custom ?? defaultFaceOrder());
}

// Startpunkt der eigenen Reihenfolge: wie "Trumpf zuerst" im Normalspiel
const ALL_FACES: FaceOrder = sortHand(
  SUITS.flatMap((s) => RANKS.map((r) => `${s}-${r}-0` as Card)),
  { mode: 'normal', schweinchen: false },
).map(faceOf);

export function defaultFaceOrder(): FaceOrder {
  return [...ALL_FACES];
}

/** Gespeicherte Reihenfolge prüfen und um fehlende Kartenarten ergänzen */
export function normalizeFaceOrder(raw: unknown): FaceOrder | null {
  if (!Array.isArray(raw)) return null;
  const known = [...new Set(raw.filter((f): f is string => typeof f === 'string' && ALL_FACES.includes(f)))];
  for (const f of ALL_FACES) if (!known.includes(f)) known.push(f);
  return known;
}

export function applyFaceOrder(hand: Card[], order: FaceOrder): Card[] {
  const idx = (c: Card) => {
    const i = order.indexOf(faceOf(c));
    return (i < 0 ? order.length : i) * 2 + copy(c);
  };
  return [...hand].sort((a, b) => idx(a) - idx(b));
}

/**
 * Übernimmt das Ziehen einer Karte in die globale Rangfolge: Die gezogene Kartenart rutscht direkt
 * vor ihre neue rechte Nachbarin, ganz nach vorne bzw. hinten gezogen an den Anfang bzw. das Ende.
 * Alle anderen behalten ihre Reihenfolge.
 */
export function updateFaceOrder(order: FaceOrder, before: Card[], after: Card[]): FaceOrder {
  const moved = after.find((c) => {
    const a = after.filter((x) => x !== c);
    const b = before.filter((x) => x !== c);
    return a.length === b.length && a.every((x, i) => x === b[i]) && before.indexOf(c) !== after.indexOf(c);
  });
  if (!moved) return order;
  const face = faceOf(moved);
  const i = after.indexOf(moved);
  const nextFace = after.slice(i + 1).map(faceOf).find((f) => f !== face);
  const prevFace = after.slice(0, i).map(faceOf).reverse().find((f) => f !== face);
  const rest = order.filter((f) => f !== face);
  // Ganz nach vorne bzw. hinten gezogen: dann auch in der Rangfolge ganz vorne bzw. hinten
  if (i === 0) rest.unshift(face);
  else if (i === after.length - 1) rest.push(face);
  else if (nextFace !== undefined) rest.splice(rest.indexOf(nextFace), 0, face);
  else if (prevFace !== undefined) rest.splice(rest.indexOf(prevFace) + 1, 0, face);
  else return order;
  return rest;
}

/** Bringt die Rangfolge so in Einklang mit einer gezeigten Hand, dass deren Reihenfolge erhalten bleibt. */
export function orderFromHand(order: FaceOrder, hand: Card[]): FaceOrder {
  let next = order;
  for (let i = 1; i < hand.length; i++) {
    const shownBefore = applyFaceOrder(hand.slice(0, i + 1), next);
    if (shownBefore.every((c, j) => c === hand[j])) continue;
    next = updateFaceOrder(next, shownBefore, hand.slice(0, i + 1));
  }
  return next;
}
