// Spielablauf eines einzelnen Spiels als reine Zustandsmaschine.
// Positionen 0–3 sind die vier aktiven Spieler im Uhrzeigersinn.

import { type Card, type Rng, deal, faceOf, isValidCard, rankOf, sumAugen } from './cards.ts';
import { countTrumps, isTrump, legalCards, trickWinnerIndex, type TrickContext } from './rules.ts';
import { type RuleSettings, type SoloType, SOLO_TYPES } from './settings.ts';
import { scoreGame, type GameResult } from './scoring.ts';

export type Party = 're' | 'kontra';
/** 120 = nur "Re"/"Kontra", 90/60/30 = "keine 90/60/30", 0 = "schwarz". */
export type AnnounceLevel = 120 | 90 | 60 | 30 | 0;
export const ANNOUNCE_LEVELS: AnnounceLevel[] = [120, 90, 60, 30, 0];

export type SchmeissenReason = 'over80' | 'fiveKings' | 'fewTrumps' | 'fiveNines';

export type Declaration =
  | { kind: 'healthy' }
  | { kind: 'hochzeit' }
  | { kind: 'armut' }
  | { kind: 'schmeissen'; reason: SchmeissenReason }
  | { kind: 'solo'; solo: SoloType };

export type GameKind = 'normal' | 'hochzeit' | 'armut' | 'solo' | 'silentSolo';
export type Phase = 'reservations' | 'armutOffer' | 'armutReturn' | 'playing' | 'finished';

export interface Trick {
  leader: number;
  /** cards[i] wurde von Position (leader + i) % 4 gespielt. */
  cards: Card[];
  winner: number | null;
}

export interface Announcement {
  pos: number;
  party: Party;
  level: AnnounceLevel;
}

export interface GameState {
  version: number;
  settings: RuleSettings;
  players: string[];
  /** Erster Spieler (links vom Geber): gibt den ersten Vorbehalt ab und spielt aus. */
  starter: number;
  phase: Phase;
  hands: Card[][];
  dealtHands: Card[][];
  declarations: (Declaration | null)[];
  declTurn: number | null;
  kind: GameKind | null;
  solo: SoloType | null;
  soloist: number | null;
  hochzeit: { bride: number; partner: number | null; decidedAfter: number | null; alone: boolean } | null;
  armut: {
    poor: number;
    rich: number | null;
    offerTurn: number | null;
    declined: number[];
    returnedTrumps: number | null;
  } | null;
  reTeam: number[];
  schweinchen: number | null;
  schweinchenRevealed: boolean;
  tricks: Trick[];
  current: Trick | null;
  turn: number | null;
  announcements: Record<Party, AnnounceLevel | null>;
  announcementLog: Announcement[];
  redeal: { reason: 'schmeissen' | 'armut'; pos: number; detail?: string } | null;
  result: GameResult | null;
}

export type GameAction =
  | { type: 'declare'; declaration: Declaration }
  | { type: 'armutAnswer'; accept: boolean }
  | { type: 'armutReturn'; cards: Card[] }
  | { type: 'play'; card: Card }
  | { type: 'announce'; level: AnnounceLevel };

export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameError';
  }
}

const next = (pos: number) => (pos + 1) % 4;

export function createGame(opts: {
  players: string[];
  starter: number;
  settings: RuleSettings;
  rng?: Rng;
  hands?: Card[][];
}): GameState {
  if (opts.players.length !== 4) throw new GameError('Ein Spiel braucht genau vier aktive Spieler.');
  const hands = opts.hands ?? deal(opts.settings.withNines, opts.rng);
  return {
    version: 0,
    settings: opts.settings,
    players: [...opts.players],
    starter: opts.starter,
    phase: 'reservations',
    hands: hands.map((h) => [...h]),
    dealtHands: hands.map((h) => [...h]),
    declarations: [null, null, null, null],
    declTurn: opts.starter,
    kind: null,
    solo: null,
    soloist: null,
    hochzeit: null,
    armut: null,
    reTeam: [],
    schweinchen: null,
    schweinchenRevealed: false,
    tricks: [],
    current: null,
    turn: null,
    announcements: { re: null, kontra: null },
    announcementLog: [],
    redeal: null,
    result: null,
  };
}

export function handSize(settings: RuleSettings): number {
  return settings.withNines ? 12 : 10;
}

export function trickContext(s: Pick<GameState, 'kind' | 'solo' | 'schweinchen' | 'settings'>): TrickContext {
  return {
    mode: s.kind === 'solo' && s.solo ? s.solo : 'normal',
    schweinchen: s.schweinchen !== null,
    dulleRule: s.settings.dulleRule,
  };
}

const NORMAL_CTX = { mode: 'normal' as const, schweinchen: false };

export function schmeissenReasons(hand: Card[], settings: RuleSettings): SchmeissenReason[] {
  const reasons: SchmeissenReason[] = [];
  const count = (rank: string) => hand.filter((c) => rankOf(c) === rank).length;
  if (settings.schmeissen.over80 && sumAugen(hand) > 80) reasons.push('over80');
  if (settings.schmeissen.fiveKings && count('K') >= 5) reasons.push('fiveKings');
  if (settings.schmeissen.fewTrumps && countTrumps(hand, NORMAL_CTX) < 3) reasons.push('fewTrumps');
  if (settings.schmeissen.fiveNines && settings.withNines && count('9') >= 5) reasons.push('fiveNines');
  return reasons;
}

/** Alle Vorbehalte, die ein Spieler mit dieser Hand ansagen darf. */
export function allowedDeclarations(hand: Card[], settings: RuleSettings): Declaration[] {
  const out: Declaration[] = [{ kind: 'healthy' }];
  if (hand.filter((c) => faceOf(c) === 'C-Q').length === 2) out.push({ kind: 'hochzeit' });
  if (settings.armut && countTrumps(hand, NORMAL_CTX) === 3) out.push({ kind: 'armut' });
  for (const reason of schmeissenReasons(hand, settings)) out.push({ kind: 'schmeissen', reason });
  for (const solo of SOLO_TYPES) if (settings.soli[solo]) out.push({ kind: 'solo', solo });
  return out;
}

function sameDeclaration(a: Declaration, b: Declaration): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function partyOf(s: GameState, pos: number): Party {
  return s.reTeam.includes(pos) ? 're' : 'kontra';
}

/** Ob die Spielerin an Position `pos` jetzt diese Ansage machen darf. Gibt eine Fehlermeldung oder null zurück. */
export function announceError(s: GameState, pos: number, level: AnnounceLevel): string | null {
  if (!s.settings.announcements) return 'Ansagen sind an diesem Tisch ausgeschaltet.';
  if (s.phase !== 'playing') return 'Ansagen sind nur während des Spiels möglich.';
  if (!ANNOUNCE_LEVELS.includes(level)) return 'Unbekannte Ansage.';
  if (s.kind === 'hochzeit' && s.hochzeit && s.hochzeit.partner === null && !s.hochzeit.alone) {
    return 'Bei einer Hochzeit sind Ansagen erst nach der Klärung möglich.';
  }
  const party = partyOf(s, pos);
  const current = s.announcements[party];
  if (current !== null && level >= current) return 'Diese Ansage wurde schon gemacht.';
  const steps: Record<AnnounceLevel, number> = { 120: 1, 90: 2, 60: 3, 30: 4, 0: 5 };
  const shift = s.kind === 'hochzeit' ? (s.hochzeit?.decidedAfter ?? 0) : 0;
  if (s.hands[pos].length < handSize(s.settings) - steps[level] - shift) return 'Für diese Ansage ist es zu spät.';
  return null;
}

export function applyAction(state: GameState, pos: number, action: GameAction): GameState {
  if (pos < 0 || pos > 3) throw new GameError('Du spielst in diesem Spiel nicht mit.');
  const s = structuredClone(state);
  switch (action.type) {
    case 'declare':
      declare(s, pos, action.declaration);
      break;
    case 'armutAnswer':
      armutAnswer(s, pos, action.accept);
      break;
    case 'armutReturn':
      armutReturn(s, pos, action.cards);
      break;
    case 'play':
      play(s, pos, action.card);
      break;
    case 'announce': {
      const err = announceError(s, pos, action.level);
      if (err) throw new GameError(err);
      const party = partyOf(s, pos);
      s.announcements[party] = action.level;
      s.announcementLog.push({ pos, party, level: action.level });
      break;
    }
    default:
      throw new GameError('Unbekannte Aktion.');
  }
  s.version = state.version + 1;
  return s;
}

function declare(s: GameState, pos: number, declaration: Declaration) {
  if (s.phase !== 'reservations') throw new GameError('Vorbehalte sind gerade nicht dran.');
  if (s.declTurn !== pos) throw new GameError('Du bist noch nicht dran.');
  const allowed = allowedDeclarations(s.hands[pos], s.settings);
  if (!declaration || !allowed.some((d) => sameDeclaration(d, declaration))) {
    throw new GameError('Diesen Vorbehalt kannst du mit deiner Hand nicht ansagen.');
  }
  s.declarations[pos] = declaration;
  const n = next(pos);
  if (n === s.starter) {
    s.declTurn = null;
    resolveReservations(s);
  } else {
    s.declTurn = n;
  }
}

function resolveReservations(s: GameState) {
  const order = [0, 1, 2, 3].map((i) => (s.starter + i) % 4);
  const first = (kind: Declaration['kind']) => order.find((p) => s.declarations[p]!.kind === kind);

  const thrower = first('schmeissen');
  if (thrower !== undefined) {
    const d = s.declarations[thrower] as Extract<Declaration, { kind: 'schmeissen' }>;
    s.redeal = { reason: 'schmeissen', pos: thrower, detail: d.reason };
    s.phase = 'finished';
    return;
  }

  const soloist = first('solo');
  if (soloist !== undefined) {
    const d = s.declarations[soloist] as Extract<Declaration, { kind: 'solo' }>;
    s.kind = 'solo';
    s.solo = d.solo;
    s.soloist = soloist;
    s.reTeam = [soloist];
    startPlay(s, soloist);
    return;
  }

  const poor = first('armut');
  if (poor !== undefined) {
    s.armut = { poor, rich: null, offerTurn: next(poor), declined: [], returnedTrumps: null };
    s.phase = 'armutOffer';
    return;
  }

  const bride = first('hochzeit');
  if (bride !== undefined) {
    s.kind = 'hochzeit';
    s.hochzeit = { bride, partner: null, decidedAfter: null, alone: false };
    s.reTeam = [bride];
    startPlay(s, s.starter);
    return;
  }

  const holders = order.filter((p) => s.hands[p].some((c) => faceOf(c) === 'C-Q'));
  if (holders.length === 1) {
    s.kind = 'silentSolo';
    s.soloist = holders[0];
    s.reTeam = [holders[0]];
  } else {
    s.kind = 'normal';
    s.reTeam = holders.sort();
  }
  startPlay(s, s.starter);
}

function startPlay(s: GameState, leader: number) {
  s.phase = 'playing';
  if (s.settings.schweinchen && s.kind !== 'solo') {
    const owner = s.hands.findIndex((h) => h.filter((c) => faceOf(c) === 'D-A').length === 2);
    s.schweinchen = owner >= 0 ? owner : null;
  }
  s.current = { leader, cards: [], winner: null };
  s.turn = leader;
}

function armutAnswer(s: GameState, pos: number, accept: boolean) {
  const a = s.armut;
  if (s.phase !== 'armutOffer' || !a) throw new GameError('Es wird gerade keine Armut angeboten.');
  if (a.offerTurn !== pos) throw new GameError('Du bist noch nicht dran.');
  if (accept) {
    a.rich = pos;
    a.offerTurn = null;
    const trumps = s.hands[a.poor].filter((c) => isTrump(c, NORMAL_CTX));
    s.hands[a.poor] = s.hands[a.poor].filter((c) => !trumps.includes(c));
    s.hands[pos] = [...s.hands[pos], ...trumps];
    s.phase = 'armutReturn';
    return;
  }
  a.declined.push(pos);
  const n = next(pos);
  if (n === a.poor) {
    s.redeal = { reason: 'armut', pos: a.poor };
    s.phase = 'finished';
    a.offerTurn = null;
  } else {
    a.offerTurn = n;
  }
}

function armutReturn(s: GameState, pos: number, cards: Card[]) {
  const a = s.armut;
  if (s.phase !== 'armutReturn' || !a) throw new GameError('Gerade werden keine Karten zurückgegeben.');
  if (a.rich !== pos) throw new GameError('Nur wer die Armut mitnimmt, gibt Karten zurück.');
  if (!Array.isArray(cards) || cards.length !== 3 || new Set(cards).size !== 3) {
    throw new GameError('Bitte genau drei Karten auswählen.');
  }
  if (!cards.every((c) => isValidCard(c) && s.hands[pos].includes(c))) {
    throw new GameError('Du kannst nur Karten aus deiner Hand zurückgeben.');
  }
  s.hands[pos] = s.hands[pos].filter((c) => !cards.includes(c));
  s.hands[a.poor] = [...s.hands[a.poor], ...cards];
  a.returnedTrumps = cards.filter((c) => isTrump(c, NORMAL_CTX)).length;
  s.kind = 'armut';
  s.reTeam = [a.poor, a.rich].sort();
  startPlay(s, s.starter);
}

function play(s: GameState, pos: number, card: Card) {
  if (s.phase !== 'playing' || !s.current) throw new GameError('Gerade werden keine Karten gespielt.');
  if (s.turn !== pos) throw new GameError('Du bist noch nicht dran.');
  if (!isValidCard(card) || !s.hands[pos].includes(card)) throw new GameError('Diese Karte hast du nicht.');
  const ctx = trickContext(s);
  if (!legalCards(s.hands[pos], s.current.cards, ctx).includes(card)) {
    throw new GameError('Du musst bedienen.');
  }

  s.hands[pos] = s.hands[pos].filter((c) => c !== card);
  s.current.cards.push(card);
  if (s.schweinchen === pos && faceOf(card) === 'D-A') s.schweinchenRevealed = true;

  if (s.current.cards.length < 4) {
    s.turn = next(pos);
    return;
  }

  const isLast = s.hands.every((h) => h.length === 0);
  const winner = (s.current.leader + trickWinnerIndex(s.current.cards, ctx, isLast)) % 4;
  s.current.winner = winner;
  s.tricks.push(s.current);

  const h = s.hochzeit;
  if (s.kind === 'hochzeit' && h && h.partner === null && !h.alone) {
    if (winner !== h.bride) {
      h.partner = winner;
      h.decidedAfter = s.tricks.length;
      s.reTeam = [h.bride, winner].sort();
    } else if (s.tricks.length >= 3) {
      h.alone = true;
      h.decidedAfter = s.tricks.length;
    }
  }

  if (isLast) {
    s.current = null;
    s.turn = null;
    s.phase = 'finished';
    s.result = scoreGame(s);
  } else {
    s.current = { leader: winner, cards: [], winner: null };
    s.turn = winner;
  }
}
