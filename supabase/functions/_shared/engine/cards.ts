// Karten-Grundlagen: Farben, Werte, Augen, Deck.
// Eine Karte ist ein String "<Farbe>-<Wert>-<Kopie>", z. B. "H-10-0" für die erste Herz-Zehn.

export type Suit = 'C' | 'S' | 'H' | 'D'; // Kreuz, Pik, Herz, Karo
export type Rank = '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type Card = string;

export const SUITS: Suit[] = ['C', 'S', 'H', 'D'];
export const RANKS: Rank[] = ['9', '10', 'J', 'Q', 'K', 'A'];

export const AUGEN: Record<Rank, number> = { '9': 0, '10': 10, J: 2, Q: 3, K: 4, A: 11 };

export function suitOf(card: Card): Suit {
  return card.split('-')[0] as Suit;
}

export function rankOf(card: Card): Rank {
  return card.split('-')[1] as Rank;
}

/** Karte ohne Kopie-Index, z. B. "H-10". Zwei gleiche Karten haben denselben Schlüssel. */
export function faceOf(card: Card): string {
  const [s, r] = card.split('-');
  return `${s}-${r}`;
}

export function augenOf(card: Card): number {
  return AUGEN[rankOf(card)];
}

export function sumAugen(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + augenOf(c), 0);
}

export function isValidCard(card: unknown): card is Card {
  if (typeof card !== 'string') return false;
  const [s, r, i] = card.split('-');
  return SUITS.includes(s as Suit) && RANKS.includes(r as Rank) && (i === '0' || i === '1');
}

export function createDeck(withNines: boolean): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      if (r === '9' && !withNines) continue;
      deck.push(`${s}-${r}-0`, `${s}-${r}-1`);
    }
  }
  return deck;
}

export type Rng = () => number;

/** Kryptografisch sicherer Zufall in [0, 1). Funktioniert im Browser und in Deno. */
export const secureRandom: Rng = () => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
};

export function shuffle<T>(items: T[], rng: Rng = secureRandom): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function deal(withNines: boolean, rng: Rng = secureRandom): Card[][] {
  const deck = shuffle(createDeck(withNines), rng);
  const size = deck.length / 4;
  return [0, 1, 2, 3].map((p) => deck.slice(p * size, (p + 1) * size));
}

export const SUIT_NAMES: Record<Suit, string> = { C: 'Kreuz', S: 'Pik', H: 'Herz', D: 'Karo' };
export const RANK_NAMES: Record<Rank, string> = {
  '9': 'Neun',
  '10': 'Zehn',
  J: 'Bube',
  Q: 'Dame',
  K: 'König',
  A: 'As',
};

export function cardName(card: Card): string {
  return `${SUIT_NAMES[suitOf(card)]}-${RANK_NAMES[rankOf(card)]}`;
}
