import { useCallback, useSyncExternalStore } from 'react';

// Persönliche Anzeige-Einstellungen. Liegen nur im Browser (localStorage), nicht am Tisch.

export interface Prefs {
  /** Spielbare Karten hervorheben, nicht spielbare abdunkeln. Aus = "schwarz spielen" ohne Hilfe. */
  highlightPlayable: boolean;
  /** 3D-Szene und Hintergrund-Partikel */
  effects: boolean;
  /** Soundeffekte (Karten, Ansagen, du bist dran …) */
  sound: boolean;
  /** Lautstärke 0–1 */
  volume: number;
}

const DEFAULTS: Prefs = { highlightPlayable: true, effects: true, sound: true, volume: 0.6 };
const KEY = 'doko:prefs';

const listeners = new Set<() => void>();
let cache: Prefs | null = null;

function read(): Prefs {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = { ...DEFAULTS, ...(raw ? (JSON.parse(raw) as Partial<Prefs>) : {}) };
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

/** Ob aufwendige Effekte laufen sollen: Einstellung an, keine reduzierte Bewegung, kein sehr schwaches Gerät. */
export function useEffectsEnabled(): boolean {
  const [prefs] = usePrefs();
  if (!prefs.effects || typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  if ((nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2) return false;
  return true;
}
