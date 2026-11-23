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
  | 'pairs'
  | 'lead'
  | 'follow'
  | 'free'
  | 'trump'
  | 'trumpBeats'
  | 'highest'
  | 'equal'
  | 'special'
  | 'order'
  | 'dulle'
  | 'spielart'
  | 'ansagen'
  | 'augen'
  | 'doppelkopf'
  | 'fuchs'
  | 'karlchen';

export const RULE_ORDER: RuleKey[] = [
  'pairs',
  'lead',
  'follow',
  'free',
  'trump',
  'trumpBeats',
  'highest',
  'equal',
  'special',
  'order',
  'dulle',
  'spielart',
  'ansagen',
  'augen',
  'doppelkopf',
  'fuchs',
  'karlchen',
];

/** Lernstufen nach dem Scaffolding-Prinzip: jede Stufe baut auf der vorigen auf */
export const LEARN_LEVELS = [
  { title: 'Grundlagen', intro: 'Zwei gegen zwei: Wer eine Kreuz-Dame hat, spielt Re, die anderen Kontra – wer zusammengehört, ist anfangs geheim. Jede Runde ist ein Stich.' },
  { title: 'Rangfolge', intro: 'Welcher Trumpf schlägt welchen? Rechts siehst du die ganze Reihenfolge – dazu, was bei zwei Herz-Zehnen gilt.' },
  { title: 'Spielarten & Ansagen', intro: 'Nicht jedes Spiel ist ein Normalspiel: Hochzeit, Solo und Armut ändern die Paare. Mit Ansagen erhöht man den Einsatz.' },
  { title: 'Punkte', intro: 'Am Ende zählen die Augen: Re braucht 121 von 240. Dazu gibt es Sonderpunkte für besondere Stiche.' },
] as const;

export const RULE_LEVEL: Record<RuleKey, number> = {
  pairs: 1,
  lead: 1,
  follow: 1,
  free: 1,
  trump: 1,
  trumpBeats: 1,
  highest: 1,
  equal: 1,
  special: 1,
  order: 2,
  dulle: 2,
  spielart: 3,
  ansagen: 3,
  augen: 4,
  doppelkopf: 4,
  fuchs: 4,
  karlchen: 4,
};

export function ruleTexts(
  settings: RuleSettings,
  trumpText: string,
  mode: TrickContext['mode'] = 'normal',
): Record<RuleKey, { title: string; text: string } | null> {
  const order =
    mode === 'queens' || mode === 'jacks'
      ? 'Kreuz › Pik › Herz › Karo, danach die Fehlfarben: Ass › 10 › König …'
      : mode === 'fleischlos'
        ? 'Kein Trumpf – in jeder Farbe: Ass › 10 › König › Dame › Bube.'
        : `Herz-10 › Kreuz-, Pik-, Herz-, Karo-Dame › Buben (gleiche Folge) › ${mode === 'normal' ? 'Karo' : 'Trumpffarbe'}: Ass › 10 › König.`;
  const dulle =
    settings.dulleRule === 'first'
      ? 'Zwei Herz-Zehnen: die erste gewinnt'
      : settings.dulleRule === 'second'
        ? 'Zwei Herz-Zehnen: die zweite gewinnt'
        : 'Zwei Herz-Zehnen: die erste – im letzten Stich die zweite';
  return {
    pairs: { title: 'Paare', text: 'Re (mit Kreuz-Dame) gegen Kontra. Erst wer die Kreuz-Dame spielt, verrät sich.' },
    lead: { title: 'Ausspielen', text: 'Wer den letzten Stich holt, spielt frei aus.' },
    follow: { title: 'Bedienen', text: 'Ausgespielte Farbe bzw. Trumpf muss zugegeben werden.' },
    free: { title: 'Nicht bedienen können', text: 'Dann darfst du jede andere Karte legen – mit Trumpf holst du den Stich.' },
    trump: { title: 'Trumpf', text: trumpText },
    trumpBeats: { title: 'Stechen', text: 'Trumpf schlägt jede Fehlfarbe.' },
    highest: { title: 'Höchste Karte', text: 'Sonst gewinnt die höchste Karte der ausgespielten Farbe.' },
    equal: { title: 'Gleiche Karten', text: 'Liegen zwei gleiche Karten, gewinnt die zuerst gespielte.' },
    special: {
      title: 'Sonderkarten',
      text: 'Herz-10 „Dulle“ = höchster Trumpf · Kreuz-Dame = Re · Karo-Ass „Fuchs“ · Kreuz-Bube „Karlchen“.',
    },
    order: { title: 'Trumpf-Rangfolge', text: order },
    dulle: { title: 'Dulle', text: `${dulle}.` },
    spielart: { title: 'Spielarten', text: 'Hochzeit: beide Kreuz-Damen, der erste Fremdstich wird Partner. Solo: einer gegen drei. Armut: höchstens 3 Trümpfe abgeben.' },
    ansagen: { title: 'Ansagen', text: 'Re/Kontra verdoppeln den Einsatz, „Keine 90/60/30“ verlangen mehr Augen.' },
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
  if (ctx.mode === 'normal') {
    if (cards.some((c) => ['H-10', 'C-Q', 'D-A', 'C-J'].includes(faceOf(c)))) rules.add('special');
    if (cards.some((c) => faceOf(c) === 'C-Q')) rules.add('pairs');
  }
  if (cards.filter((c) => isTrump(c, ctx)).length >= 2) rules.add('order');

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
  if (reason === 'highest') rules.add('highest');
  if (reason === 'highestTrump') rules.add('order');
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

/** Ausführliche Erklärung: Karte für Karte, warum der Stich so lief – nur mit dem Wissen der jeweiligen Lernstufe */
export function lessonText(l: TrickLesson, cards: Card[], ctx: TrickContext, name: (pos: number) => string, level = 4): string[] {
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
    else lines.push(`${who} hat kein ${ledName} mehr und legt ${card} – eine andere Farbe holt den Stich nicht.`);
    if (ctx.mode === 'normal' && faceOf(p.card) === 'C-Q') lines.push(`Kreuz-Dame gespielt: ${who} gehört zu Re.`);
  }
  if (l.complete) {
    const winPos = l.plays[l.winnerIdx].pos;
    const card = cardName(cards[l.winnerIdx]);
    const why =
      l.reason === 'trumpBeats'
        ? `${card} ist Trumpf und schlägt jede ${ledName}-Karte`
        : l.reason === 'highestTrump'
          ? level >= 2
            ? `${card} steht in der Trumpf-Rangfolge am höchsten`
            : `${card} ist der stärkste Trumpf im Stich`
          : l.reason === 'highest'
            ? `${card} ist die höchste ${ledName}-Karte, gestochen hat niemand`
            : l.reason === 'dulle'
              ? level >= 2
                ? 'zwei Herz-Zehnen liegen – nach der Dullen-Regel zählt diese'
                : 'die Herz-10 ist der höchste Trumpf (was bei zwei Herz-Zehnen gilt, kommt in Stufe 2)'
              : `${card} liegt doppelt – die zuerst gespielte gewinnt`;
    lines.push(`${name(winPos)} gewinnt den Stich: ${why}.${level >= 4 ? ` ${l.augen} Augen wandern zu ${name(winPos)}.` : ''}`);
    if (level >= 4) {
      if (l.specials.includes('doppelkopf')) lines.push('Über 40 Augen in einem Stich: Doppelkopf, +1 Punkt.');
      if (l.specials.includes('fuchs')) lines.push('Ein Karo-Ass der Gegenseite wurde gefangen: Fuchs, +1 Punkt.');
      if (l.specials.includes('karlchen')) lines.push('Der Kreuz-Bube holt den letzten Stich: Karlchen, +1 Punkt.');
    } else if (l.specials.length) {
      lines.push('Hier gab es einen Sonderpunkt – wie Punkte zählen, kommt in Stufe 4.');
    }
  }
  return lines;
}
