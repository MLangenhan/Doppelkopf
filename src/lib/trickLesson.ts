import {
  type Card,
  cardName,
  effectiveSuit,
  faceOf,
  isTrump,
  type Party,
  type RuleSettings,
  SUIT_NAMES,
  sumAugen,
  type TrickContext,
  trickWinnerIndex,
} from '@engine';

/** Regeln, die im Lernmodus aufgelistet und – wenn gerade benutzt – hervorgehoben werden */
export type RuleKey =
  | 'lead'
  | 'follow'
  | 'free'
  | 'trump'
  | 'trumpBeats'
  | 'highest'
  | 'equal'
  | 'dulle'
  | 'augen'
  | 'fuchs'
  | 'karlchen'
  | 'doppelkopf';

export const RULE_ORDER: RuleKey[] = ['lead', 'follow', 'free', 'trump', 'trumpBeats', 'highest', 'equal', 'dulle', 'augen', 'doppelkopf', 'fuchs', 'karlchen'];

export function ruleTexts(settings: RuleSettings, trumpText: string): Record<RuleKey, { title: string; text: string } | null> {
  const dulle =
    settings.dulleRule === 'first'
      ? 'Zwei Herz-Zehnen: die erste gewinnt'
      : settings.dulleRule === 'second'
        ? 'Zwei Herz-Zehnen: die zweite gewinnt'
        : 'Zwei Herz-Zehnen: die erste – im letzten Stich die zweite';
  return {
    lead: { title: 'Ausspielen', text: 'Wer den letzten Stich holt, spielt frei aus.' },
    follow: { title: 'Bedienen', text: 'Ausgespielte Farbe bzw. Trumpf muss zugegeben werden.' },
    free: { title: 'Nicht bedienen können', text: 'Dann frei: stechen (Trumpf) oder abwerfen.' },
    trump: { title: 'Trumpf', text: trumpText },
    trumpBeats: { title: 'Stechen', text: 'Trumpf schlägt jede Fehlfarbe.' },
    highest: { title: 'Höchste Karte', text: 'Ohne Trumpf gewinnt die höchste Karte der ausgespielten Farbe.' },
    equal: { title: 'Gleiche Karten', text: 'Liegen zwei gleiche Karten, gewinnt die zuerst gespielte.' },
    dulle: { title: 'Dulle', text: `Herz-Zehn ist höchster Trumpf. ${dulle}.` },
    augen: { title: 'Augen', text: 'Ass 11 · Zehn 10 · König 4 · Dame 3 · Bube 2. Re braucht 121 von 240.' },
    doppelkopf: settings.doppelkopf ? { title: 'Doppelkopf', text: 'Stich mit 40 Augen oder mehr: +1 Punkt.' } : null,
    fuchs: settings.fuchs ? { title: 'Fuchs', text: 'Karo-Ass vom Gegner gefangen: +1 Punkt.' } : null,
    karlchen: settings.karlchen ? { title: 'Karlchen', text: 'Kreuz-Bube gewinnt den letzten Stich: +1 Punkt.' } : null,
  };
}

export type PlayKind = 'lead' | 'follow' | 'trump' | 'discard';

export interface TrickLesson {
  /** Position im Stich (0 = ausgespielt) der jeweils höchsten Karte bzw. des Gewinners */
  winnerIdx: number;
  complete: boolean;
  plays: { idx: number; pos: number; card: Card; kind: PlayKind; leadingAfter: boolean }[];
  /** Warum gewinnt die Gewinnerkarte */
  reason: 'trumpBeats' | 'highestTrump' | 'highest' | 'equal' | 'dulle' | 'alone';
  augen: number;
  specials: ('doppelkopf' | 'fuchs' | 'karlchen')[];
  rules: RuleKey[];
}

/**
 * Wertet einen (auch unfertigen) Stich aus: Wer hat bedient, gestochen oder abgeworfen, wer liegt vorne und warum.
 * Ob jemand bedienen konnte, folgt aus den Karten selbst: Der Server lässt Abweichen nur zu, wenn man es muss.
 */
export function analyzeTrick(
  cards: Card[],
  leader: number,
  ctx: TrickContext,
  opts: { isLast: boolean; settings: RuleSettings; partyOf?: (pos: number) => Party | null },
): TrickLesson {
  const led = effectiveSuit(cards[0], ctx);
  const rules = new Set<RuleKey>(['lead']);
  const plays: TrickLesson['plays'] = [];
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const e = effectiveSuit(c, ctx);
    const kind: PlayKind = i === 0 ? 'lead' : e === led ? 'follow' : e === 'T' ? 'trump' : 'discard';
    if (kind === 'follow') rules.add('follow');
    if (kind === 'trump' || kind === 'discard') rules.add('free');
    if (kind === 'trump') rules.add('trumpBeats');
    const lead = trickWinnerIndex(cards.slice(0, i + 1), ctx, opts.isLast);
    plays.push({ idx: i, pos: (leader + i) % 4, card: c, kind, leadingAfter: lead === i });
  }
  if (isTrump(cards[0], ctx) || cards.some((c) => isTrump(c, ctx))) rules.add('trump');

  const winnerIdx = trickWinnerIndex(cards, ctx, opts.isLast);
  const win = cards[winnerIdx];
  const twins = cards.filter((c) => faceOf(c) === faceOf(win)).length > 1;
  let reason: TrickLesson['reason'];
  if (cards.length === 1) reason = 'alone';
  else if (twins && faceOf(win) === 'H-10' && isTrump(win, ctx)) reason = 'dulle';
  else if (twins && cards.findIndex((c) => faceOf(c) === faceOf(win)) === winnerIdx) reason = 'equal';
  else if (isTrump(win, ctx) && led !== 'T') reason = 'trumpBeats';
  else if (isTrump(win, ctx)) reason = 'highestTrump';
  else reason = 'highest';
  if (reason === 'dulle') rules.add('dulle');
  if (reason === 'equal') rules.add('equal');
  if (reason === 'highest' || reason === 'highestTrump') rules.add('highest');
  if (reason === 'trumpBeats') rules.add('trumpBeats');

  const complete = cards.length === 4;
  const augen = sumAugen(cards);
  const specials: TrickLesson['specials'] = [];
  if (complete) {
    rules.add('augen');
    const solo = ctx.mode !== 'normal';
    const winPos = (leader + winnerIdx) % 4;
    if (!solo && opts.settings.doppelkopf && augen >= 40) specials.push('doppelkopf');
    if (!solo && opts.settings.fuchs && !ctx.schweinchen) {
      const caught = cards.some((c, j) => {
        if (faceOf(c) !== 'D-A' || j === winnerIdx) return false;
        const a = opts.partyOf?.((leader + j) % 4);
        const b = opts.partyOf?.(winPos);
        return a && b ? a !== b : false;
      });
      if (caught) specials.push('fuchs');
    }
    if (!solo && opts.settings.karlchen && opts.isLast && faceOf(win) === 'C-J') specials.push('karlchen');
    for (const s of specials) rules.add(s);
  }
  return { winnerIdx, complete, plays, reason, augen, specials, rules: RULE_ORDER.filter((r) => rules.has(r)) };
}

/** Ausführliche Erklärung: Karte für Karte, warum der Stich so lief */
export function lessonText(l: TrickLesson, cards: Card[], ctx: TrickContext, name: (pos: number) => string): string[] {
  const led = effectiveSuit(cards[0], ctx);
  const ledName = led === 'T' ? 'Trumpf' : SUIT_NAMES[led];
  const lines: string[] = [];
  for (const p of l.plays) {
    const who = name(p.pos);
    const card = cardName(p.card);
    const lead = p.leadingAfter && p.idx > 0 ? ' und liegt damit vorne' : '';
    if (p.kind === 'lead') lines.push(`${who} spielt ${card} aus – ${led === 'T' ? 'Trumpf' : `Fehlfarbe ${ledName}`}. Alle müssen ${ledName} bedienen.`);
    else if (p.kind === 'follow') lines.push(`${who} bedient mit ${card}${lead}.`);
    else if (p.kind === 'trump') lines.push(`${who} hat kein ${ledName} mehr und sticht mit ${card} (Trumpf)${lead}.`);
    else lines.push(`${who} hat kein ${ledName} mehr und wirft ${card} ab – das kann nicht gewinnen.`);
  }
  if (l.complete) {
    const winPos = l.plays[l.winnerIdx].pos;
    const card = cardName(cards[l.winnerIdx]);
    const why =
      l.reason === 'trumpBeats'
        ? `${card} ist Trumpf und schlägt jede ${ledName}-Karte`
        : l.reason === 'highestTrump'
          ? `${card} ist der höchste Trumpf im Stich`
          : l.reason === 'highest'
            ? `${card} ist die höchste ${ledName}-Karte, gestochen hat niemand`
            : l.reason === 'dulle'
              ? `zwei Herz-Zehnen liegen – nach der Dullen-Regel zählt diese`
              : `${card} liegt doppelt – die zuerst gespielte gewinnt`;
    lines.push(`${name(winPos)} gewinnt den Stich: ${why}. ${l.augen} Augen wandern zu ${name(winPos)}.`);
    if (l.specials.includes('doppelkopf')) lines.push('Über 40 Augen in einem Stich: Doppelkopf, +1 Punkt.');
    if (l.specials.includes('fuchs')) lines.push('Ein Karo-Ass der Gegenseite wurde gefangen: Fuchs, +1 Punkt.');
    if (l.specials.includes('karlchen')) lines.push('Der Kreuz-Bube holt den letzten Stich: Karlchen, +1 Punkt.');
  }
  return lines;
}

