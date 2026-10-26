import {
  allowedDeclarations,
  announceError,
  augenOf,
  type Card,
  cardPower,
  createDeck,
  type Declaration,
  effectiveSuit,
  faceOf,
  type GameAction,
  type GameState,
  isTrump,
  knownParties,
  legalCards,
  type Party,
  rankOf,
  scoreGame,
  type SoloType,
  type Trick,
  type TrickContext,
  trickContext,
  trickWinnerIndex,
} from '@engine';

// Bots für den Übungsmodus. Sie sehen nur, was ein Mensch an ihrem Platz auch sähe:
// die eigene Hand, gespielte Karten, Ansagen und Kartenzahlen – nie die Hände der anderen.
//
// - Leicht:  spielt legal, nimmt wertvolle Stiche mit, macht aber oft Fehler.
// - Mittel:  denkt in Parteien (schmieren beim Partner, Fuchs retten, sichere Stiche),
//            sagt mit starker Hand an und spielt mit sehr starker Hand Soli.
// - Schwer:  wie Mittel, entscheidet jede Karte aber per Simulation: viele mögliche
//            Verteilungen der unbekannten Karten werden zu Ende gespielt und gewertet.

export type BotLevel = 'easy' | 'medium' | 'hard';

export const BOT_LEVEL_LABELS: Record<BotLevel, string> = { easy: 'Leicht', medium: 'Mittel', hard: 'Schwer' };

export interface BotOptions {
  /** Zufall (für reproduzierbare Tests) */
  rng?: () => number;
  /** Schwer: Rechenzeit pro Entscheidung in ms */
  budgetMs?: number;
  /** Schwer: feste Zahl an Simulationen pro Karte statt Zeitbudget */
  samples?: number;
  /** Nur für Experimente: Ansagen bzw. Vorbehalte (Soli, Armut, Schmeißen) abschalten */
  noAnnounce?: boolean;
  noReservations?: boolean;
}

type Ctx = TrickContext;

export function botAction(s: GameState, pos: number, level: BotLevel = 'medium', opts: BotOptions = {}): GameAction | null {
  const rng = opts.rng ?? Math.random;
  const hand = s.hands[pos];

  if (s.phase === 'reservations' && s.declTurn === pos) {
    return { type: 'declare', declaration: chooseDeclaration(s, pos, opts.noReservations ? 'easy' : level) };
  }

  if (s.phase === 'armutOffer' && s.armut?.offerTurn === pos) {
    const n = NORMAL_CTX;
    const trumps = hand.filter((c) => isTrump(c, n));
    const top = trumps.filter((c) => ['H-10', 'C-Q', 'S-Q'].includes(faceOf(c))).length;
    const accept = level === 'easy' ? trumps.length >= 7 : trumps.length >= 6 && top >= 2;
    return { type: 'armutAnswer', accept };
  }

  if (s.phase === 'armutReturn' && s.armut?.rich === pos) {
    // Die drei schwächsten Karten zurückgeben: Fehl ohne Asse, möglichst ganze Farben
    const ctx = trickContext(s);
    const keep = (c: Card) => (isTrump(c, ctx) ? 1000 + cardPower(c, ctx) : rankOf(c) === 'A' ? 500 : augenOf(c) * 10);
    const sorted = [...hand].sort((a, b) => keep(a) - keep(b));
    return { type: 'armutReturn', cards: sorted.slice(0, 3) };
  }

  if (s.phase !== 'playing' || s.turn !== pos) return null;
  if (s.collectPending) return { type: 'collect' };
  if (!s.current) return null;

  const announce = opts.noAnnounce ? null : chooseAnnouncement(s, pos, level, rng, opts);
  if (announce !== null) return { type: 'announce', level: announce };

  if (level === 'easy') return { type: 'play', card: easyCard(s, pos, rng) };
  if (level === 'hard') return { type: 'play', card: hardCard(s, pos, rng, opts) };
  return { type: 'play', card: mediumCard(s, pos) };
}

const NORMAL_CTX: Ctx = { mode: 'normal', schweinchen: false, dulleRule: 'first' };

// ---------------------------------------------------------------------------
// Vorbehalte
// ---------------------------------------------------------------------------

function chooseDeclaration(s: GameState, pos: number, level: BotLevel): Declaration {
  const hand = s.hands[pos];
  const options = allowedDeclarations(hand, s.settings);
  const has = (d: Declaration) => options.find((o) => JSON.stringify(o) === JSON.stringify(d));

  if (level !== 'easy') {
    const solo = bestSolo(hand, options, s);
    if (solo) return solo;
    // Mit sehr schlechter Hand lieber neu geben bzw. Armut
    const throwIt = options.find((o) => o.kind === 'schmeissen' && o.reason === 'fewTrumps');
    if (throwIt && level === 'hard') return throwIt;
    const armut = has({ kind: 'armut' });
    if (armut && !hand.some((c) => ['H-10', 'C-Q'].includes(faceOf(c)))) return armut;
  }
  return has({ kind: 'hochzeit' }) ?? { kind: 'healthy' };
}

/** Bewertet jedes erlaubte Solo grob und spielt es nur mit sehr starker Hand. */
function bestSolo(hand: Card[], options: Declaration[], s: GameState): Declaration | null {
  let best: { d: Declaration; v: number } | null = null;
  for (const o of options) {
    if (o.kind !== 'solo') continue;
    const v = soloStrength(hand, o.solo, s);
    if (v >= 1 && (!best || v > best.v)) best = { d: o, v };
  }
  return best?.d ?? null;
}

function soloStrength(hand: Card[], solo: SoloType, s: GameState): number {
  const ctx: Ctx = { mode: solo, schweinchen: false, dulleRule: s.settings.dulleRule };
  const size = hand.length;
  const trumps = hand.filter((c) => isTrump(c, ctx));
  // Fehl-Asse (und Zehnen hinter dem Ass) stehen sicher
  const bySuit = new Map<string, Card[]>();
  for (const c of hand) {
    if (isTrump(c, ctx)) continue;
    const k = effectiveSuit(c, ctx);
    bySuit.set(k, [...(bySuit.get(k) ?? []), c]);
  }
  let sure = 0;
  let losers = 0;
  for (const cards of bySuit.values()) {
    const aces = cards.filter((c) => rankOf(c) === 'A').length;
    sure += aces;
    losers += Math.max(0, cards.length - aces * 2);
  }

  if (solo === 'queens' || solo === 'jacks') {
    const top = solo === 'queens' ? 'C-Q' : 'C-J';
    const second = solo === 'queens' ? 'S-Q' : 'S-J';
    const strength = trumps.length + hand.filter((c) => faceOf(c) === top).length + hand.filter((c) => faceOf(c) === second).length * 0.5;
    return strength >= 7 && losers <= 1 ? 1 + strength / 10 : 0;
  }
  if (solo === 'fleischlos') {
    return sure >= 5 && losers === 0 ? 1 + sure / 10 : 0;
  }
  // Farbsoli: fast nur Trümpfe, die höchsten dabei, kaum Fehl ohne Ass
  const top = hand.filter((c) => ['H-10', 'C-Q', 'S-Q'].includes(faceOf(c))).length;
  const queens = hand.filter((c) => rankOf(c) === 'Q').length;
  return trumps.length >= size * 0.9 && top >= 3 && queens >= 3 && losers === 0 ? 1 + trumps.length / size : 0;
}

// ---------------------------------------------------------------------------
// Ansagen
// ---------------------------------------------------------------------------

function chooseAnnouncement(s: GameState, pos: number, level: BotLevel, rng: () => number, opts: BotOptions) {
  if (level === 'easy') return null;
  if (announceError(s, pos, 120) !== null && announceError(s, pos, 90) !== null) return null;
  const party = myParty(s, pos);
  if (!party) return null;
  const mine = s.announcements[party];

  if (level === 'medium') {
    if (mine !== null) return null;
    const ctx = trickContext(s);
    const hand = s.hands[pos];
    const top = hand.filter((c) => isTrump(c, ctx) && cardPower(c, ctx) >= cardPower('S-Q-0', ctx)).length;
    const trumps = hand.filter((c) => isTrump(c, ctx)).length;
    const strong = s.kind === 'solo' ? top >= 4 : top >= 3 && trumps >= hand.length / 2;
    return strong && announceError(s, pos, 120) === null ? 120 : null;
  }

  // Schwer: Siegchance per Simulation schätzen, nur am Anfang des Spiels (danach ist's zu spät)
  if (s.tricks.length > 2) return null;
  const est = estimate(s, pos, rng, opts);
  if (mine === null && est.win >= 0.78 && announceError(s, pos, 120) === null) return 120;
  if (mine === 120 && est.under90 >= 0.85 && announceError(s, pos, 90) === null) return 90;
  return null;
}

// ---------------------------------------------------------------------------
// Wissen: was ein Spieler an diesem Platz weiß
// ---------------------------------------------------------------------------

function myParty(s: GameState, pos: number): Party | null {
  if (s.kind === 'hochzeit' && s.hochzeit && s.hochzeit.partner === null && !s.hochzeit.alone && pos !== s.hochzeit.bride) return null;
  return s.reTeam.includes(pos) ? 're' : 'kontra';
}

interface Knowledge {
  ctx: Ctx;
  parties: (Party | null)[];
  /** Karten, die ich weder auf der Hand habe noch gespielt wurden */
  unknown: Card[];
  /** voids[p] = effektive Farben ('T' für Trumpf), die p nicht mehr hat */
  voids: Set<string>[];
  /** Wie oft jede effektive Farbe schon angespielt wurde */
  led: Map<string, number>;
}

function allTricks(s: GameState): Trick[] {
  return s.current && s.current.cards.length && !s.collectPending ? [...s.tricks, s.current] : s.tricks;
}

function knowledge(s: GameState, pos: number): Knowledge {
  const ctx = trickContext(s);
  const parties = knownParties(s);
  parties[pos] = myParty(s, pos);
  // Ein stilles Solo ist für die anderen unsichtbar: sie halten es für ein Normalspiel
  const played = new Set<Card>();
  const voids = [0, 1, 2, 3].map(() => new Set<string>());
  const led = new Map<string, number>();
  for (const t of allTricks(s)) {
    const ledSuit = effectiveSuit(t.cards[0], ctx);
    led.set(ledSuit, (led.get(ledSuit) ?? 0) + 1);
    t.cards.forEach((c, i) => {
      played.add(c);
      if (i > 0 && effectiveSuit(c, ctx) !== ledSuit) voids[(t.leader + i) % 4].add(ledSuit);
    });
  }
  const mine = new Set(s.hands[pos]);
  const unknown = createDeck(s.settings.withNines).filter((c) => !played.has(c) && !mine.has(c));
  return { ctx, parties, unknown, voids, led };
}

// ---------------------------------------------------------------------------
// Leicht
// ---------------------------------------------------------------------------

function easyCard(s: GameState, pos: number, rng: () => number): Card {
  const ctx = trickContext(s);
  const hand = s.hands[pos];
  const trick = s.current!.cards;
  const legal = legalCards(hand, trick, ctx);
  if (rng() < 0.3) return legal[Math.floor(rng() * legal.length)];
  const isLast = hand.length === 1 && s.hands.every((h) => h.length <= 1);
  const cheapest = (cards: Card[]) => [...cards].sort((a, b) => augenOf(a) - augenOf(b) || cardPower(a, ctx) - cardPower(b, ctx))[0];

  if (trick.length === 0) {
    const aces = legal.filter((c) => !isTrump(c, ctx) && rankOf(c) === 'A');
    return aces[0] ?? cheapest(legal);
  }
  const winners = legal.filter((c) => trickWinnerIndex([...trick, c], ctx, isLast) === trick.length);
  const value = trick.reduce((sum, c) => sum + augenOf(c), 0);
  if (winners.length && (value >= 10 || trick.length === 3)) return [...winners].sort((a, b) => cardPower(a, ctx) - cardPower(b, ctx))[0];
  return cheapest(legal);
}

// ---------------------------------------------------------------------------
// Mittel: Heuristik mit Parteiwissen. Wird auch in den Simulationen von "Schwer" benutzt.
// ---------------------------------------------------------------------------

interface PlayInput {
  hand: Card[];
  trick: Card[];
  leader: number;
  pos: number;
  ctx: Ctx;
  lastTrick: boolean;
  /** Partei eines Spielers aus meiner Sicht (null = unbekannt) */
  party: (p: number) => Party | null;
  /** Karten, die die nach mir kommenden Spieler haben könnten */
  threats: Card[];
  /** Schon so oft angespielte Farben */
  led: Map<string, number>;
  /** Ob noch jemand nach mir in dieser Farbe abstechen könnte */
  ruffRisk: (suit: string) => boolean;
  fuchs: boolean;
  karlchen: boolean;
}

function mediumCard(s: GameState, pos: number): Card {
  const k = knowledge(s, pos);
  const t = s.current!;
  const later = [1, 2, 3].map((i) => (t.leader + t.cards.length + i) % 4).slice(0, 3 - t.cards.length);
  const input: PlayInput = {
    hand: s.hands[pos],
    trick: t.cards,
    leader: t.leader,
    pos,
    ctx: k.ctx,
    lastTrick: s.hands[pos].length === 1,
    party: (p) => k.parties[p],
    threats: k.unknown,
    led: k.led,
    ruffRisk: (suit) => {
      if (suit === 'T') return false;
      if (later.some((p) => k.voids[p].has(suit))) return true;
      // Weniger offene Karten dieser Farbe als Mitspieler nach mir: jemand ist frei
      const open = k.unknown.filter((c) => effectiveSuit(c, k.ctx) === suit).length;
      return open < later.length;
    },
    fuchs: s.settings.fuchs && s.schweinchen === null && s.kind !== 'solo',
    karlchen: s.settings.karlchen && s.kind !== 'solo',
  };
  return heuristicPlay(input);
}

function heuristicPlay(x: PlayInput): Card {
  const { ctx, hand, trick } = x;
  const legal = legalCards(hand, trick, ctx);
  if (legal.length === 1) return legal[0];
  const me = x.party(x.pos);
  const isFox = (c: Card) => x.fuchs && faceOf(c) === 'D-A' && isTrump(c, ctx);
  const isKarl = (c: Card) => x.karlchen && faceOf(c) === 'C-J' && !x.lastTrick;
  const power = (c: Card) => cardPower(c, ctx);
  const isHigh = (c: Card) => isTrump(c, ctx) && power(c) >= cardPower('H-Q-0', ctx);
  // Wie ungern gebe ich eine Karte her (niedrig = gern)
  const cost = (c: Card) =>
    augenOf(c) + (isTrump(c, ctx) ? 4 + (isHigh(c) ? 8 : 0) : 0) + (isFox(c) ? 20 : 0) + (isKarl(c) ? 8 : 0);
  const cheapest = (cards: Card[]) => [...cards].sort((a, b) => cost(a) - cost(b) || power(a) - power(b))[0];
  const beats = (c: Card, cards: Card[]) => trickWinnerIndex([...cards, c], ctx, x.lastTrick) === cards.length;

  // ---- Ausspielen ----
  if (trick.length === 0) {
    // Asse in Farben, die noch nicht gelaufen sind, bringen fast sicher Augen
    const aces = legal.filter((c) => !isTrump(c, ctx) && rankOf(c) === 'A' && !(x.led.get(effectiveSuit(c, ctx)) ?? 0));
    if (aces.length) return aces[0];
    const trumps = legal.filter((c) => isTrump(c, ctx) && !isFox(c) && !isKarl(c));
    const fehl = legal.filter((c) => !isTrump(c, ctx));
    // Re (und Solist) zieht Trumpf, Kontra spielt lieber Fehl an
    if (trumps.length && (me === 're' || !fehl.length)) return [...trumps].sort((a, b) => power(a) - power(b))[0];
    if (fehl.length) {
      // Keine Zehn oder blanken König in eine Farbe, deren Ass noch draußen ist
      const aceOut = (c: Card) => x.threats.some((t) => effectiveSuit(t, ctx) === effectiveSuit(c, ctx) && rankOf(t) === 'A');
      const safe = fehl.filter((c) => augenOf(c) < 10 || !aceOut(c));
      return cheapest(safe.length ? safe : fehl);
    }
    return cheapest(legal);
  }

  // ---- Zugeben ----
  const winIdx = trickWinnerIndex(trick, ctx, x.lastTrick);
  const winner = (x.leader + winIdx) % 4;
  const lastToPlay = trick.length === 3;
  const value = trick.reduce((sum, c) => sum + augenOf(c), 0);
  const ledSuit = effectiveSuit(trick[0], ctx);
  const partnerWins = me !== null && x.party(winner) === me;
  const opponentWins = me !== null && x.party(winner) !== null && x.party(winner) !== me;
  // Kann eine Karte, die jetzt vorne liegt, von den Späteren noch überstochen werden?
  const canBeBeaten = (card: Card) => {
    if (lastToPlay) return false;
    if (!isTrump(card, ctx) && x.ruffRisk(ledSuit)) return true;
    const cards = [...trick.filter((_, i) => i !== trick.indexOf(card)), card];
    return x.threats.some((t) => beats(t, cards));
  };
  const winners = legal.filter((c) => beats(c, trick));

  if (partnerWins && (lastToPlay || !canBeBeaten(trick[winIdx]))) {
    // Schmieren: dem Partner Augen geben, gern den Fuchs in Sicherheit bringen
    const fox = legal.find(isFox);
    if (fox) return fox;
    const fat = legal.filter((c) => !isKarl(c) && !isHigh(c)).sort((a, b) => augenOf(b) - augenOf(a) || power(a) - power(b));
    return fat[0] ?? cheapest(legal);
  }

  if (winners.length && !partnerWins) {
    const byPower = [...winners].sort((a, b) => power(a) - power(b));
    if (lastToPlay) {
      // Als Letzter: mit der billigsten Siegkarte nehmen, wenn es sich lohnt
      const pick = cheapest(byPower.filter((c) => !isKarl(c) || x.lastTrick)) ?? byPower[0];
      if (value + augenOf(pick) >= cost(pick) || opponentWins || value >= 10) return pick;
    } else {
      const safe = byPower.filter((c) => !canBeBeaten(c) && !isFox(c));
      const worth = value >= 10 || opponentWins || hand.length <= 3;
      if (safe.length && worth) return safe[0];
      if (safe.length && !isHigh(safe[0])) return safe[0];
      // Viele Augen im Stich: auch ohne Garantie mit einer günstigen Karte versuchen
      const cheapWin = byPower.find((c) => !isFox(c) && !isHigh(c) && !isKarl(c));
      if (value >= 10 && cheapWin) return cheapWin;
    }
  }
  // Nicht zu gewinnen (oder Partner liegt vorn, aber unsicher): billig abwerfen, Fuchs und Karlchen behalten
  const discard = legal.filter((c) => !isFox(c) && !isKarl(c));
  return cheapest(discard.length ? discard : legal);
}

// ---------------------------------------------------------------------------
// Schwer: Monte-Carlo über mögliche Verteilungen
// ---------------------------------------------------------------------------

function hardCard(s: GameState, pos: number, rng: () => number, opts: BotOptions): Card {
  const ctx = trickContext(s);
  const legal = legalCards(s.hands[pos], s.current!.cards, ctx);
  if (legal.length === 1) return legal[0];
  const k = knowledge(s, pos);
  // Gleichwertige Karten (zweite Kopie) nur einmal rechnen
  const options = [...new Map(legal.map((c) => [faceOf(c), c])).values()];
  if (options.length === 1) return options[0];

  const total = new Map<Card, number>(options.map((c) => [c, 0]));
  let rounds = 0;
  const start = performance.now();
  const budget = opts.budgetMs ?? 220;
  const minRounds = opts.samples ?? 12;
  const maxRounds = opts.samples ?? 400;
  while (rounds < maxRounds && (rounds < minRounds || (!opts.samples && performance.now() - start < budget))) {
    const world = sampleWorld(s, pos, k, rng);
    if (!world) break;
    for (const c of options) total.set(c, total.get(c)! + rollout(s, pos, world, c));
    rounds++;
  }
  if (!rounds) return mediumCard(s, pos);
  // Bei Gleichstand die Heuristik entscheiden lassen
  const fallback = mediumCard(s, pos);
  let best = options[0];
  for (const c of options) {
    const v = total.get(c)! + (faceOf(c) === faceOf(fallback) ? 0.01 : 0);
    const b = total.get(best)! + (faceOf(best) === faceOf(fallback) ? 0.01 : 0);
    if (v > b) best = c;
  }
  return best;
}

/** Siegchance und Chance, dass der Gegner unter 90 bleibt – für Ansagen. */
function estimate(s: GameState, pos: number, rng: () => number, opts: BotOptions) {
  const k = knowledge(s, pos);
  let wins = 0;
  let under90 = 0;
  let n = 0;
  const rounds = opts.samples ?? 30;
  for (let i = 0; i < rounds; i++) {
    const world = sampleWorld(s, pos, k, rng);
    if (!world) break;
    const r = playOut(s, pos, world, null);
    const mine = r.reTeam.includes(pos) ? 're' : 'kontra';
    const opp = mine === 're' ? 'kontra' : 're';
    if (r.result.winner === mine) wins++;
    if (r.result.augen[opp] < 90) under90++;
    n++;
  }
  return { win: n ? wins / n : 0, under90: n ? under90 / n : 0 };
}

interface World {
  hands: Card[][];
}

/** Verteilt die unbekannten Karten zufällig, aber passend zu allem, was man weiß. */
function sampleWorld(s: GameState, pos: number, k: Knowledge, rng: () => number): World | null {
  const need = s.hands.map((h) => h.length);
  const normalLike = s.kind === 'normal' || s.kind === 'silentSolo';
  const qPlayed = new Set<number>();
  for (const t of allTricks(s)) t.cards.forEach((c, i) => faceOf(c) === 'C-Q' && qPlayed.add((t.leader + i) % 4));

  for (let attempt = 0; attempt < 40; attempt++) {
    const hands: Card[][] = [0, 1, 2, 3].map((p) => (p === pos ? [...s.hands[pos]] : []));
    const room = need.map((n, p) => (p === pos ? 0 : n));
    const pool = shuffle([...k.unknown], rng);
    const strict = attempt < 30;
    const fits = (p: number, c: Card) => room[p] > 0 && (!strict || !k.voids[p].has(effectiveSuit(c, k.ctx)));
    const give = (p: number, c: Card) => {
      hands[p].push(c);
      room[p]--;
      pool.splice(pool.indexOf(c), 1);
    };

    if (normalLike) {
      // Kreuz-Damen: wer als Re bekannt ist und noch keine gezeigt hat, hat eine; Kontra hat keine
      const queens = pool.filter((c) => faceOf(c) === 'C-Q');
      for (let p = 0; p < 4 && queens.length; p++) {
        if (p !== pos && k.parties[p] === 're' && !qPlayed.has(p) && fits(p, queens[0])) give(p, queens.shift()!);
      }
      for (const q of queens) {
        const cands = [0, 1, 2, 3].filter((p) => p !== pos && k.parties[p] !== 'kontra' && fits(p, q));
        if (cands.length) give(cands[Math.floor(rng() * cands.length)], q);
      }
    }
    let ok = true;
    for (const c of [...pool]) {
      const cands = [0, 1, 2, 3].filter((p) => p !== pos && fits(p, c) && !(normalLike && faceOf(c) === 'C-Q' && k.parties[p] === 'kontra' && strict));
      if (!cands.length) {
        ok = false;
        break;
      }
      // Wer noch viel Platz hat, bekommt eher etwas (sonst bleiben die Engpässe am Ende übrig)
      const weights = cands.map((p) => room[p]);
      let r = rng() * weights.reduce((a, b) => a + b, 0);
      let pick = cands[0];
      for (let i = 0; i < cands.length; i++) {
        r -= weights[i];
        if (r <= 0) {
          pick = cands[i];
          break;
        }
      }
      give(pick, c);
    }
    if (ok) return { hands };
  }
  return null;
}

function shuffle<T>(a: T[], rng: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Spielt ein Spiel in einer angenommenen Verteilung zu Ende. Alle spielen dort mit der Heuristik. */
function playOut(s: GameState, pos: number, world: World, first: Card | null) {
  const ctx = trickContext(s);
  const hands = world.hands.map((h) => [...h]);
  const tricks: Trick[] = [...s.tricks];
  let cur: Trick = { leader: s.current!.leader, cards: [...s.current!.cards], winner: null };
  const led = new Map<string, number>();
  for (const t of [...tricks, cur]) if (t.cards.length) led.set(effectiveSuit(t.cards[0], ctx), (led.get(effectiveSuit(t.cards[0], ctx)) ?? 0) + 1);

  // Parteien in dieser Welt
  let reTeam = [...s.reTeam];
  let kind = s.kind;
  if (s.kind === 'normal' || s.kind === 'silentSolo') {
    const holders = new Set<number>();
    const dealt = [0, 1, 2, 3].map((p) => [...hands[p]]);
    for (const t of [...tricks, cur]) t.cards.forEach((c, i) => dealt[(t.leader + i) % 4].push(c));
    dealt.forEach((h, p) => h.forEach((c) => faceOf(c) === 'C-Q' && holders.add(p)));
    reTeam = [...holders].sort();
    kind = reTeam.length === 1 ? 'silentSolo' : 'normal';
  }
  const hz = s.kind === 'hochzeit' && s.hochzeit && s.hochzeit.partner === null && !s.hochzeit.alone ? s.hochzeit : null;
  const partyIn = (team: number[]) => (p: number): Party => (team.includes(p) ? 're' : 'kontra');
  const fuchs = s.settings.fuchs && s.schweinchen === null && kind !== 'solo';
  const karlchen = s.settings.karlchen && kind !== 'solo';

  let firstPending = first;
  while (hands.some((h) => h.length)) {
    const p = (cur.leader + cur.cards.length) % 4;
    const hand = hands[p];
    let card: Card;
    if (p === pos && firstPending) {
      card = firstPending;
      firstPending = null;
    } else {
      const later = [1, 2, 3].map((i) => (p + i) % 4).slice(0, 3 - cur.cards.length);
      const team = hz ? [hz.bride] : reTeam;
      const party = partyIn(team);
      card = heuristicPlay({
        hand,
        trick: cur.cards,
        leader: cur.leader,
        pos: p,
        ctx,
        lastTrick: hand.length === 1,
        party: (q) => (hz && q !== hz.bride && q !== p ? null : party(q)),
        threats: later.flatMap((q) => hands[q]),
        led,
        ruffRisk: (suit) => suit !== 'T' && later.some((q) => !hands[q].some((c) => effectiveSuit(c, ctx) === suit)),
        fuchs,
        karlchen,
      });
    }
    hand.splice(hand.indexOf(card), 1);
    if (!cur.cards.length) led.set(effectiveSuit(card, ctx), (led.get(effectiveSuit(card, ctx)) ?? 0) + 1);
    cur.cards.push(card);
    if (cur.cards.length === 4) {
      const last = hands.every((h) => h.length === 0);
      const w = (cur.leader + trickWinnerIndex(cur.cards, ctx, last)) % 4;
      cur.winner = w;
      tricks.push(cur);
      cur = { leader: w, cards: [], winner: null };
    }
  }

  if (hz) {
    // Hochzeit: Partner wird, wer den ersten fremden Stich macht (innerhalb der Frist)
    const limit = 3;
    const partner = tricks.slice(0, limit).find((t) => t.winner !== hz.bride)?.winner;
    reTeam = partner == null ? [hz.bride] : [hz.bride, partner].sort();
  }
  const hochzeit = hz ? { ...hz, partner: reTeam[1] === undefined ? null : reTeam.find((p) => p !== hz.bride)!, alone: reTeam.length === 1 } : s.hochzeit;

  const fake: GameState = { ...s, kind, reTeam, hochzeit, tricks, current: null, hands: [[], [], [], []], phase: 'finished' };
  return { result: scoreGame(fake), reTeam };
}

function rollout(s: GameState, pos: number, world: World, card: Card): number {
  const { result, reTeam } = playOut(s, pos, world, card);
  const mine: Party = reTeam.includes(pos) ? 're' : 'kontra';
  // Spielpunkte zählen, Augen entscheiden bei Gleichstand
  return result.scores[pos] + (result.augen[mine] - 120) * 0.02;
}
