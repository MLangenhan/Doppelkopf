import {
  ANNOUNCE_LEVELS,
  announceError,
  type AnnounceLevel,
  type GameState,
  type Card,
  countTrumps,
  type Declaration,
  faceOf,
  type Party,
  type PublicGameState,
  type SchmeissenReason,
  SOLO_NAMES,
  type SoloType,
  type TrumpMode,
} from '@engine';

export const SCHMEISSEN_LABEL: Record<SchmeissenReason, string> = {
  over80: 'mehr als 80 Augen',
  fiveKings: '5 Könige',
  fewTrumps: 'weniger als 3 Trümpfe',
  fiveNines: '5 Neunen',
};

export function partyLabel(p: Party) {
  return p === 're' ? 'Re' : 'Kontra';
}

export function levelLabel(level: AnnounceLevel, party: Party) {
  if (level === 120) return partyLabel(party);
  if (level === 0) return 'Schwarz';
  return `Keine ${level}`;
}

export function declarationLabel(d: Declaration) {
  switch (d.kind) {
    case 'healthy':
      return 'Gesund';
    case 'hochzeit':
      return 'Hochzeit';
    case 'armut':
      return 'Armut';
    case 'schmeissen':
      return `Schmeißen (${SCHMEISSEN_LABEL[d.reason]})`;
    case 'solo':
      return SOLO_NAMES[d.solo];
  }
}

export function soloLabel(s: SoloType | null) {
  return s ? SOLO_NAMES[s] : 'Solo';
}

export function trumpMode(view: Pick<PublicGameState, 'kind' | 'solo'>): TrumpMode {
  return view.kind === 'solo' && view.solo ? view.solo : 'normal';
}

/** Kurzbeschreibung der Spielart für die Infoleiste. */
export function gameKindLabel(view: PublicGameState, name: (pos: number) => string): string {
  switch (view.kind) {
    case null:
      return view.phase === 'armutOffer' || view.phase === 'armutReturn' ? 'Armut' : 'Vorbehalte';
    case 'normal':
      return 'Normalspiel';
    case 'solo':
      return `${soloLabel(view.solo)} von ${name(view.soloist!)}`;
    case 'hochzeit': {
      const h = view.hochzeit!;
      if (h.partner !== null) return `Hochzeit: ${name(h.bride)} & ${name(h.partner)}`;
      if (h.alone) return `Hochzeit: ${name(h.bride)} spielt allein`;
      return `Hochzeit von ${name(h.bride)} – Partner gesucht`;
    }
    case 'armut': {
      const a = view.armut!;
      return `Armut: ${name(a.poor)} & ${name(a.rich!)}`;
    }
  }
}

export function resultKindLabel(kind: string, solo: string | null) {
  switch (kind) {
    case 'normal':
      return 'Normal';
    case 'hochzeit':
      return 'Hochzeit';
    case 'armut':
      return 'Armut';
    case 'silentSolo':
      return 'Stilles Solo';
    case 'solo':
      return solo ? SOLO_NAMES[solo as SoloType] : 'Solo';
    default:
      return kind;
  }
}

/** Die eigene Partei, soweit man sie selbst kennt. */
export function myParty(view: PublicGameState, myPos: number, hand: Card[]): Party | null {
  if (myPos < 0) return null;
  const known = view.knownParties[myPos];
  if (known) return known;
  if (view.kind === 'hochzeit') return null;
  if (view.kind === 'normal') return hand.some((c) => faceOf(c) === 'C-Q') ? 're' : 'kontra';
  return null;
}

export function hasSchweinchen(view: PublicGameState, hand: Card[]) {
  return (
    view.settings.schweinchen && view.kind !== 'solo' && hand.filter((c) => faceOf(c) === 'D-A').length === 2
  );
}

export function trumpCountText(hand: Card[], view: PublicGameState) {
  return countTrumps(hand, { mode: trumpMode(view), schweinchen: false });
}

/** Welche Ansagen ich gerade machen darf (der Server prüft das nochmal). */
export function announceOptions(view: PublicGameState, myPos: number, party: Party | null): AnnounceLevel[] {
  if (myPos < 0 || !party) return [];
  const pseudo = {
    settings: view.settings,
    phase: view.phase,
    kind: view.kind,
    hochzeit: view.hochzeit,
    reTeam: party === 're' ? [myPos] : [],
    announcements: view.announcements,
    hands: view.handCounts.map((n) => new Array(n)),
  } as unknown as GameState;
  return ANNOUNCE_LEVELS.filter((l) => announceError(pseudo, myPos, l) === null);
}
