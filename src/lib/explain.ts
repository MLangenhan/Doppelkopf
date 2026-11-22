import {
  type Card,
  cardName,
  cardPower,
  effectiveSuit,
  faceOf,
  isTrump,
  legalCards,
  SOLO_NAMES,
  SUIT_NAMES,
  type Suit,
  type TrumpMode,
} from '@engine';

type Ctx = { mode: TrumpMode; schweinchen: boolean };

const unique = (cards: Card[]) => [...new Map(cards.map((c) => [faceOf(c), c])).values()];
const list = (cards: Card[]) => {
  const names = unique(cards).map(cardName);
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} und ${names.at(-1)}`;
};

/** Was in diesem Spiel Trumpf ist – kurz erklärt */
export function trumpRule(mode: TrumpMode): string {
  if (mode === 'normal') return 'Trumpf sind Herz-Zehn, alle Damen, alle Buben und alle Karo-Karten.';
  if (mode === 'queens') return `${SOLO_NAMES.queens}: Nur die Damen sind Trumpf.`;
  if (mode === 'jacks') return `${SOLO_NAMES.jacks}: Nur die Buben sind Trumpf.`;
  if (mode === 'fleischlos') return `${SOLO_NAMES.fleischlos}: Es gibt keinen Trumpf.`;
  return `${SOLO_NAMES[mode]}: Trumpf sind Herz-Zehn, Damen, Buben und alle ${SUIT_NAMES[mode === 'clubs' ? 'C' : mode === 'spades' ? 'S' : mode === 'hearts' ? 'H' : 'D']}-Karten.`;
}

const kindName = (k: Suit | 'T') => (k === 'T' ? 'Trumpf' : SUIT_NAMES[k]);

/** Position der Karte, die gerade vorne liegt (gleiche Karten: die erste gewinnt) */
function leadingIndex(cards: Card[], ctx: Ctx): number {
  const led = effectiveSuit(cards[0], ctx);
  let best = 0;
  for (let i = 1; i < cards.length; i++) {
    const c = cards[i];
    const b = cards[best];
    const ec = effectiveSuit(c, ctx);
    const eb = effectiveSuit(b, ctx);
    if (ec === 'T' && eb !== 'T') best = i;
    else if (ec === eb && (ec === 'T' || ec === led) && cardPower(c, ctx) > cardPower(b, ctx)) best = i;
  }
  return best;
}

export interface Explanation {
  title: string;
  lines: string[];
}

/** Warum welche Karten gerade spielbar sind – für die Einstellung „Spiel erklären“ */
export function explainTurn(hand: Card[], trick: Card[], ctx: Ctx, nameAt: (i: number) => string): Explanation {
  if (trick.length === 0) {
    const trumps = hand.filter((c) => isTrump(c, ctx));
    return {
      title: 'Du spielst aus – jede Karte ist erlaubt',
      lines: [
        'Wer den Stich beginnt, darf frei wählen. Die anderen müssen dann die Farbe deiner Karte bedienen.',
        trumps.length
          ? `Spielst du Trumpf (du hast ${trumps.length}), müssen alle Trumpf zugeben. Mit einer Fehlfarbe-Ass holst du oft sicher einen Stich.`
          : 'Du hast keinen Trumpf mehr – spiel am besten eine Farbe, in der du ein Ass hast.',
        trumpRule(ctx.mode),
      ],
    };
  }

  const led = effectiveSuit(trick[0], ctx);
  const legal = legalCards(hand, trick, ctx);
  const lines: string[] = [];
  const ledText = `${nameAt(0)} hat ${cardName(trick[0])} ausgespielt – das ist ${led === 'T' ? 'Trumpf' : `die Fehlfarbe ${SUIT_NAMES[led]}`}.`;
  lines.push(ledText);

  let title: string;
  if (legal.length < hand.length) {
    title = `Du musst ${kindName(led)} bedienen`;
    lines.push(`Du hast ${kindName(led)}, also darfst du nur diese Karten legen: ${list(legal)}.`);
    const blocked = hand.filter((c) => !legal.includes(c));
    if (led !== 'T') {
      const sameSuitTrumps = blocked.filter((c) => (c.split('-')[0] as Suit) === led && isTrump(c, ctx));
      if (sameSuitTrumps.length)
        lines.push(`${list(sameSuitTrumps)} ${sameSuitTrumps.length > 1 ? 'sehen' : 'sieht'} nach ${SUIT_NAMES[led]} aus, ${sameSuitTrumps.length > 1 ? 'sind' : 'ist'} aber Trumpf und ${sameSuitTrumps.length > 1 ? 'zählen' : 'zählt'} deshalb nicht als ${SUIT_NAMES[led]}.`);
      if (blocked.some((c) => isTrump(c, ctx))) lines.push('Stechen mit Trumpf geht erst, wenn du keine Karte dieser Farbe mehr hast.');
    } else {
      lines.push('Trumpf muss mit Trumpf bedient werden – Fehlfarben sind erst erlaubt, wenn du keinen Trumpf mehr hast.');
    }
  } else {
    title = `Du hast kein ${kindName(led)} – jede Karte ist erlaubt`;
    lines.push(
      led === 'T'
        ? 'Weil du keinen Trumpf mehr hast, darfst du eine beliebige Fehlfarbe abwerfen.'
        : `Du kannst nicht bedienen: Entweder du stichst mit Trumpf, oder du wirfst eine andere Farbe ab (die gewinnt dann aber nicht).`,
    );
  }

  // Wer liegt vorne, und womit kann ich übernehmen?
  const lead = leadingIndex(trick, ctx);
  const top = trick[lead];
  lines.push(`Vorne liegt gerade ${nameAt(lead)} mit ${cardName(top)}.`);
  const beats = legal.filter((c) => leadingIndex([...trick, c], ctx) === trick.length);
  lines.push(
    beats.length
      ? `Übernehmen kannst du mit: ${list(beats)}. Bei zwei gleichen Karten gewinnt die zuerst gespielte.`
      : 'Keine deiner erlaubten Karten kann den Stich übernehmen – ist er von deinem Partner, gib ihm Augen (Ass, Zehn), sonst wirf möglichst wenig ab.',
  );
  return { title, lines };
}

/** Warum ein fertiger Stich an wen geht */
export function explainTrick(trick: Card[], winner: number, ctx: Ctx, nameAt: (i: number) => string): string {
  const led = effectiveSuit(trick[0], ctx);
  const card = trick[winner];
  const trumpIn = trick.some((c) => isTrump(c, ctx));
  if (led !== 'T' && isTrump(card, ctx)) return `${nameAt(winner)} gewinnt: ${cardName(card)} ist Trumpf und schlägt jede ${SUIT_NAMES[led]}-Karte.`;
  if (led === 'T') return `${nameAt(winner)} gewinnt mit dem höchsten Trumpf ${cardName(card)}.`;
  return `${nameAt(winner)} gewinnt mit ${cardName(card)}: höchste ${SUIT_NAMES[led]}-Karte${trumpIn ? '' : ', niemand hat gestochen'}.`;
}
