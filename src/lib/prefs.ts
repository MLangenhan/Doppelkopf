import { useCallback, useSyncExternalStore } from 'react';

// Persönliche Anzeige-Einstellungen. Liegen nur im Browser (localStorage), nicht am Tisch.

export interface Prefs {
  /** Spielbare Karten hervorheben, nicht spielbare abdunkeln. Aus = "schwarz spielen" ohne Hilfe. */
  highlightPlayable: boolean;
}

const DEFAULTS: Prefs = { highlightPlayable: true };
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
