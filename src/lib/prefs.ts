import { useCallback, useSyncExternalStore } from 'react';

// Persönliche Anzeige-Einstellungen. Liegen nur im Browser (localStorage), nicht am Tisch.

/** Einzeln schaltbare Effekte */
export type FxKey = 'scene' | 'atmosphere' | 'cursor' | 'tilt' | 'impact' | 'moments' | 'confetti' | 'reveal';

export const FX_LABELS: Record<FxKey, { label: string; hint: string }> = {
  cursor: { label: 'Farbzeichen-Zeiger', hint: 'Der Mauszeiger wird zum ♠ und nimmt über Karten deren Farbe an.' },
  tilt: { label: 'Karten neigen', hint: 'Karten in der Hand kippen zur Maus und glänzen.' },
  impact: { label: 'Trumpf-Einschlag', hint: 'Dulle, Kreuz-Dame und Schweinchen lassen den Tisch beben.' },
  moments: { label: 'Große Momente', hint: 'Ansagen, Soli, Fuchs, Doppelkopf und Karlchen erscheinen groß in der Mitte.' },
  reveal: { label: 'Spannende Auswertung', hint: 'Die Augen zählen am Ende hoch, bis der Gewinner feststeht.' },
  confetti: { label: 'Konfetti', hint: 'Bei einem Sieg regnet es Konfetti.' },
  atmosphere: { label: 'Atmosphäre', hint: 'Leichte Partikel hinter dem Tisch.' },
  scene: { label: '3D-Karten', hint: 'Schwebende 3D-Karten auf der Anmelde- und Startseite.' },
};

/** Reihenfolge der Karten in der Hand */
export type HandSort = 'trumpFirst' | 'trumpLast' | 'suits' | 'custom';

export const HAND_SORT_LABELS: Record<HandSort, string> = {
  trumpFirst: 'Trumpf zuerst',
  trumpLast: 'Trumpf zuletzt',
  suits: 'Nach Farben',
  custom: 'Eigene Reihenfolge',
};

export interface Prefs {
  /** Spielbare Karten hervorheben, nicht spielbare abdunkeln. Aus = "schwarz spielen" ohne Hilfe. */
  highlightPlayable: boolean;
  /** Einzelne Effekte */
  fx: Record<FxKey, boolean>;
  /** Kartenreihenfolge in der Hand */
  handSort: HandSort;
  /** Soundeffekte (Karten, Ansagen, du bist dran …) */
  sound: boolean;
  /** Lautstärke 0–1 */
  volume: number;
  /** Kamera beim Betreten eines Tisches einschalten */
  camera: boolean;
}

const ALL_FX = Object.keys(FX_LABELS) as FxKey[];
const fxAll = (on: boolean) => Object.fromEntries(ALL_FX.map((k) => [k, on])) as Record<FxKey, boolean>;

const DEFAULTS: Prefs = {
  highlightPlayable: true,
  fx: fxAll(true),
  handSort: 'trumpFirst',
  sound: true,
  volume: 0.6,
  camera: true,
};
const KEY = 'doko:prefs';

const listeners = new Set<() => void>();
let cache: Prefs | null = null;

function read(): Prefs {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const stored = (raw ? JSON.parse(raw) : {}) as Partial<Prefs> & { effects?: boolean };
    // Früher gab es nur einen Schalter für alle Effekte
    const fx = { ...fxAll(stored.effects !== false), ...stored.fx };
    cache = { ...DEFAULTS, ...stored, fx };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

function write(next: Prefs) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Ohne Speicher gilt die Einstellung nur bis zum Neuladen
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function usePrefs() {
  const prefs = useSyncExternalStore(subscribe, read, () => DEFAULTS);
  const set = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => write({ ...read(), [key]: value }), []);
  return [prefs, set] as const;
}

export function setFx(key: FxKey, on: boolean) {
  const p = read();
  write({ ...p, fx: { ...p.fx, [key]: on } });
}

export function setAllFx(on: boolean) {
  write({ ...read(), fx: fxAll(on) });
}

/** Für Code außerhalb von React (z. B. Kamera-Wunsch) */
export function getPrefs(): Prefs {
  return read();
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  write({ ...read(), [key]: value });
}

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const weakDevice = () => {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2;
};

/**
 * Ob ein Effekt laufen soll: Einstellung an und keine reduzierte Bewegung im System.
 * Die schweren Effekte (3D, Partikel) bleiben auf sehr schwachen Geräten zusätzlich aus.
 */
export function useFx(key: FxKey): boolean {
  const [prefs] = usePrefs();
  if (!prefs.fx[key] || typeof window === 'undefined' || reducedMotion()) return false;
  if ((key === 'scene' || key === 'atmosphere') && weakDevice()) return false;
  return true;
}
