import {
  type Card,
  type GameState,
  type RuleSettings,
  createDeck,
  createGame,
  DEFAULT_SETTINGS,
  faceOf,
  normalizeSettings,
} from '@engine';

export function settings(patch: Partial<RuleSettings> = {}): RuleSettings {
  return normalizeSettings({ ...DEFAULT_SETTINGS, ...patch });
}

/** Deterministischer Zufall für reproduzierbare Tests. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Baut eine vollständige Verteilung: Die angegebenen Karten (ohne Kopie-Index, z. B. "C-Q")
 * landen bei den jeweiligen Spielern, der Rest wird der Reihe nach aufgefüllt.
 */
export function dealWith(fixed: string[][], withNines = false): Card[][] {
  const remaining = createDeck(withNines);
  const size = remaining.length / 4;
  const take = (face: string) => {
    const idx = remaining.findIndex((c) => faceOf(c) === face);
    if (idx < 0) throw new Error(`Karte ${face} ist nicht mehr im Deck`);
    return remaining.splice(idx, 1)[0];
  };
  const hands = [0, 1, 2, 3].map((p) => (fixed[p] ?? []).map(take));
  for (const h of hands) {
    while (h.length < size) {
      // Auffüllen, aber keine Karte nehmen, die ein anderer Spieler noch explizit braucht.
      const reserved = new Set(fixed.flat());
      const idx = remaining.findIndex((c) => !reserved.has(faceOf(c)));
      h.push(remaining.splice(idx >= 0 ? idx : 0, 1)[0]);
    }
  }
  return hands;
}

export function newGame(hands: Card[][], patch: Partial<RuleSettings> = {}, starter = 0): GameState {
  return createGame({ players: ['a', 'b', 'c', 'd'], starter, settings: settings(patch), hands });
}

export const card = (face: string, copy = 0): Card => `${face}-${copy}`;
