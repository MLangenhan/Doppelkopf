import { type Card, type Suit, cardPower, effectiveSuit, rankOf, sortHand, suitOf } from '@engine';
import type { HandSort } from './prefs';

type Ctx = Parameters<typeof sortHand>[1];

// Schwarz und Rot im Wechsel, damit die Farben gut auseinanderzuhalten sind
const SUITS: Suit[] = ['C', 'H', 'S', 'D'];
const RANKS = ['A', '10', 'K', 'Q', 'J', '9'];
const copy = (c: Card) => Number(c.split('-')[2]);

/** Ordnet die Hand nach dem gewählten Muster. Bei "custom" gilt die gemerkte Reihenfolge, neue Karten werden einsortiert. */
export function arrangeHand(hand: Card[], ctx: Ctx, mode: HandSort, custom: Card[] | null): Card[] {
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
  const base = sortHand(hand, ctx);
  if (!custom) return base;
  const kept = custom.filter((c) => hand.includes(c));
  // Unbekannte Karten (z. B. aus der Armut) an ihren Platz in der Standard-Sortierung
  for (const c of base) {
    if (kept.includes(c)) continue;
    const next = base.slice(base.indexOf(c) + 1).find((n) => kept.includes(n));
    kept.splice(next ? kept.indexOf(next) : kept.length, 0, c);
  }
  return kept;
}
