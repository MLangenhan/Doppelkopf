// Was alle Spieler sehen dürfen. Die Hände stehen hier NICHT drin – die bekommt jeder nur für sich.

import { faceOf, type Card } from './cards.ts';
import type { Announcement, AnnounceLevel, GameKind, GameState, Party, Phase, Trick } from './game.ts';
import type { GameResult } from './scoring.ts';
import type { RuleSettings, SoloType } from './settings.ts';

export type DeclarationStatus = 'pending' | 'healthy' | 'reserved';

export interface PublicGameState {
  version: number;
  settings: RuleSettings;
  players: string[];
  starter: number;
  phase: Phase;
  handCounts: number[];
  declTurn: number | null;
  declarations: DeclarationStatus[];
  /** Spielart, wie sie öffentlich bekannt ist. Ein stilles Solo erscheint als 'normal'. */
  kind: Exclude<GameKind, 'silentSolo'> | null;
  solo: SoloType | null;
  soloist: number | null;
  hochzeit: GameState['hochzeit'];
  armut: GameState['armut'];
  schweinchen: number | null;
  current: Trick | null;
  lastTrick: Trick | null;
  trickWinners: number[];
  turn: number | null;
  announcements: Record<Party, AnnounceLevel | null>;
  announcementLog: Announcement[];
  /** Was über die Parteien öffentlich bekannt ist (durch Ansagen, gespielte Kreuz-Damen usw.). */
  knownParties: (Party | null)[];
  redeal: GameState['redeal'];
  /** Erst nach Spielende: Ergebnis, ausgeteilte Hände und alle Stiche. */
  result: GameResult | null;
  dealtHands: Card[][] | null;
  tricks: Trick[] | null;
  /** Bei stillem Solo nach Spielende bekannt. */
  revealedKind: GameKind | null;
}

export function knownParties(s: GameState): (Party | null)[] {
  const known: (Party | null)[] = [null, null, null, null];
  const setAll = () => [0, 1, 2, 3].forEach((p) => (known[p] = s.reTeam.includes(p) ? 're' : 'kontra'));

  if (s.phase === 'finished' && s.result) {
    setAll();
    return known;
  }
  if (s.kind === 'solo' || s.kind === 'armut') {
    setAll();
    return known;
  }
  if (s.kind === 'hochzeit' && s.hochzeit) {
    known[s.hochzeit.bride] = 're';
    if (s.hochzeit.partner !== null || s.hochzeit.alone) setAll();
    return known;
  }
  for (const a of s.announcementLog) known[a.pos] = a.party;
  const played = [...s.tricks, ...(s.current ? [s.current] : [])];
  for (const t of played) {
    t.cards.forEach((c, i) => {
      if (faceOf(c) === 'C-Q') known[(t.leader + i) % 4] = 're';
    });
  }
  if (s.kind === 'normal' && known.filter((k) => k === 're').length === 2) {
    for (let p = 0; p < 4; p++) if (known[p] === null) known[p] = 'kontra';
  }
  return known;
}

export function publicView(s: GameState): PublicGameState {
  const finished = s.phase === 'finished';
  const declarations: DeclarationStatus[] = s.declarations.map((d) =>
    d === null ? 'pending' : d.kind === 'healthy' ? 'healthy' : 'reserved',
  );
  const silent = s.kind === 'silentSolo';
  return {
    version: s.version,
    settings: s.settings,
    players: s.players,
    starter: s.starter,
    phase: s.phase,
    handCounts: s.hands.map((h) => h.length),
    declTurn: s.declTurn,
    declarations,
    kind: s.kind === 'silentSolo' ? 'normal' : s.kind,
    solo: s.solo,
    soloist: silent && !finished ? null : s.soloist,
    hochzeit: s.hochzeit,
    armut: s.armut,
    schweinchen: s.schweinchenRevealed || finished ? s.schweinchen : null,
    current: s.current,
    lastTrick: s.tricks.length ? s.tricks[s.tricks.length - 1] : null,
    trickWinners: s.tricks.map((t) => t.winner!),
    turn: s.turn,
    announcements: s.announcements,
    announcementLog: s.announcementLog,
    knownParties: knownParties(s),
    redeal: s.redeal,
    result: s.result,
    dealtHands: finished ? s.dealtHands : null,
    tricks: finished ? s.tricks : null,
    revealedKind: finished ? s.kind : null,
  };
}
