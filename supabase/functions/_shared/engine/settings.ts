// Hausregeln, die beim Erstellen eines Tisches festgelegt werden.

export type SoloType = 'queens' | 'jacks' | 'fleischlos' | 'clubs' | 'spades' | 'hearts' | 'diamonds';

export const SOLO_TYPES: SoloType[] = ['queens', 'jacks', 'fleischlos', 'clubs', 'spades', 'hearts', 'diamonds'];

export const SOLO_NAMES: Record<SoloType, string> = {
  queens: 'Damensolo',
  jacks: 'Bubensolo',
  fleischlos: 'Fleischloser',
  clubs: 'Kreuz-Solo',
  spades: 'Pik-Solo',
  hearts: 'Herz-Solo',
  diamonds: 'Karo-Solo',
};

/**
 * Wer gewinnt, wenn beide Herz-Zehnen im selben Stich liegen?
 * - first: die erste
 * - second: die zweite
 * - secondInLastTrick: die zweite, aber nur im letzten Stich
 */
export type DulleRule = 'first' | 'second' | 'secondInLastTrick';

export interface RuleSettings {
  withNines: boolean;
  dulleRule: DulleRule;
  doppelkopf: boolean;
  fuchs: boolean;
  karlchen: boolean;
  announcements: boolean;
  soli: Record<SoloType, boolean>;
  armut: boolean;
  schweinchen: boolean;
  schmeissen: {
    over80: boolean;
    fiveKings: boolean;
    fewTrumps: boolean;
    fiveNines: boolean;
  };
}

export const DEFAULT_SETTINGS: RuleSettings = {
  withNines: false,
  dulleRule: 'first',
  doppelkopf: true,
  fuchs: true,
  karlchen: true,
  announcements: true,
  soli: {
    queens: true,
    jacks: true,
    fleischlos: true,
    clubs: true,
    spades: true,
    hearts: true,
    diamonds: true,
  },
  armut: true,
  schweinchen: true,
  schmeissen: {
    over80: true,
    fiveKings: true,
    fewTrumps: true,
    fiveNines: false,
  },
};

/** Füllt fehlende Felder mit Standardwerten auf (z. B. bei alten Tischen oder Teil-Eingaben). */
export function normalizeSettings(input: unknown): RuleSettings {
  const s = (input && typeof input === 'object' ? input : {}) as Partial<RuleSettings>;
  const d = DEFAULT_SETTINGS;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  const soli = (s.soli ?? {}) as Partial<Record<SoloType, boolean>>;
  const schm = (s.schmeissen ?? {}) as Partial<RuleSettings['schmeissen']>;
  return {
    withNines: bool(s.withNines, d.withNines),
    dulleRule: s.dulleRule === 'second' || s.dulleRule === 'secondInLastTrick' ? s.dulleRule : 'first',
    doppelkopf: bool(s.doppelkopf, d.doppelkopf),
    fuchs: bool(s.fuchs, d.fuchs),
    karlchen: bool(s.karlchen, d.karlchen),
    announcements: bool(s.announcements, d.announcements),
    soli: Object.fromEntries(SOLO_TYPES.map((t) => [t, bool(soli[t], d.soli[t])])) as Record<SoloType, boolean>,
    armut: bool(s.armut, d.armut),
    schweinchen: bool(s.schweinchen, d.schweinchen),
    schmeissen: {
      over80: bool(schm.over80, d.schmeissen.over80),
      fiveKings: bool(schm.fiveKings, d.schmeissen.fiveKings),
      fewTrumps: bool(schm.fewTrumps, d.schmeissen.fewTrumps),
      fiveNines: bool(schm.fiveNines, d.schmeissen.fiveNines),
    },
  };
}
