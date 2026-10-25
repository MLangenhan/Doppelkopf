import {
  allowedDeclarations,
  announceError,
  augenOf,
  type Card,
  cardPower,
  effectiveSuit,
  faceOf,
  type GameAction,
  type GameState,
  isTrump,
  legalCards,
  trickContext,
  trickWinnerIndex,
} from '@engine';

/** Einfache Bot-Strategie für den Übungsmodus. Spielt legal und halbwegs vernünftig, aber nicht schlau. */
export function botAction(s: GameState, pos: number): GameAction | null {
  const hand = s.hands[pos];
  const ctx = trickContext(s);

  if (s.phase === 'reservations' && s.declTurn === pos) {
    const options = allowedDeclarations(hand, s.settings);
    // Hochzeit ansagen, sonst gesund (Bots werfen nicht und spielen keine Soli)
    const hochzeit = options.find((d) => d.kind === 'hochzeit');
    return { type: 'declare', declaration: hochzeit ?? { kind: 'healthy' } };
  }

  if (s.phase === 'armutOffer' && s.armut?.offerTurn === pos) {
    const trumps = hand.filter((c) => isTrump(c, { mode: 'normal', schweinchen: false })).length;
    return { type: 'armutAnswer', accept: trumps >= 7 };
  }

  if (s.phase === 'armutReturn' && s.armut?.rich === pos) {
    // Die drei niedrigsten Fehlkarten zurückgeben
    const sorted = [...hand].sort((a, b) => score(a) - score(b));
    return { type: 'armutReturn', cards: sorted.slice(0, 3) };
  }

  if (s.phase === 'playing' && s.turn === pos && s.current) {
    // Gelegentlich mit starker Hand ansagen
    const strong = hand.filter((c) => isTrump(c, ctx) && cardPower(c, ctx) >= 996).length >= 3;
    if (strong && announceError(s, pos, 120) === null) return { type: 'announce', level: 120 };
    return { type: 'play', card: chooseCard(s, pos) };
  }

  return null;

  function score(c: Card) {
    return (isTrump(c, ctx) ? 1000 : 0) + augenOf(c) * 10 + cardPower(c, ctx) / 100;
  }
}

function chooseCard(s: GameState, pos: number): Card {
  const ctx = trickContext(s);
  const hand = s.hands[pos];
  const trick = s.current!.cards;
  const legal = legalCards(hand, trick, ctx);
  const isLast = hand.length === 1 && s.hands.every((h) => h.length <= 1);

  const cheapest = (cards: Card[]) =>
    [...cards].sort((a, b) => augenOf(a) - augenOf(b) || cardPower(a, ctx) - cardPower(b, ctx))[0];

  if (trick.length === 0) {
    // Ausspielen: Fehl-As, sonst niedrigster Trumpf, sonst irgendwas Billiges
    const aces = legal.filter((c) => !isTrump(c, ctx) && faceOf(c).endsWith('-A'));
    if (aces.length) return aces[0];
    const trumps = legal.filter((c) => isTrump(c, ctx));
    if (trumps.length) return [...trumps].sort((a, b) => cardPower(a, ctx) - cardPower(b, ctx))[0];
    return cheapest(legal);
  }

  const winners = legal.filter((c) => {
    const cards = [...trick, c];
    return trickWinnerIndex(cards, ctx, isLast) === cards.length - 1;
  });
  const value = trick.reduce((sum, c) => sum + augenOf(c), 0);
  if (winners.length && (value >= 10 || trick.length === 3)) {
    return [...winners].sort((a, b) => cardPower(a, ctx) - cardPower(b, ctx))[0];
  }
  // Nicht gewinnbar: billig abwerfen, aber Fehlfarbe bevorzugen
  const led = effectiveSuit(trick[0], ctx);
  const nonTrump = legal.filter((c) => !isTrump(c, ctx) || led === 'T');
  return cheapest(nonTrump.length ? nonTrump : legal);
}
