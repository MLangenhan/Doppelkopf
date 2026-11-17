import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useAuth } from './auth';
import { type FaceOrder, normalizeFaceOrder } from './handSort';
import { supabase } from './supabase';

// Eigene Kartenreihenfolge: im Profil gespeichert (gilt auf jedem Gerät), dazu im Browser zwischengespeichert,
// damit sie sofort da ist – auch im Übungsmodus ohne Konto. Ein gemeinsamer Stand für alle Komponenten.

const KEY = 'doko:cardOrder';
const listeners = new Set<() => void>();
let current: FaceOrder | null = readLocal();
let loadedFor: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function readLocal(): FaceOrder | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeFaceOrder(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function set(order: FaceOrder) {
  current = order;
  try {
    localStorage.setItem(KEY, JSON.stringify(order));
  } catch {
    // ohne Speicher gilt sie bis zum Neuladen
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useCardOrder() {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const order = useSyncExternalStore(subscribe, () => current, () => null);

  // Einmal pro Konto aus dem Profil holen (gewinnt gegen den Browser-Zwischenstand)
  useEffect(() => {
    if (!uid || loadedFor === uid) return;
    loadedFor = uid;
    supabase
      .from('profiles')
      .select('card_order')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) return;
        const remote = normalizeFaceOrder(data?.card_order);
        if (remote) set(remote);
      });
  }, [uid]);

  const save = useCallback(
    (next: FaceOrder) => {
      set(next);
      if (!uid) return;
      // Beim Sortieren nicht bei jedem Zug speichern, sondern kurz danach
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const { error } = await supabase.from('profiles').update({ card_order: next }).eq('id', uid);
        if (error) console.warn('Kartenreihenfolge nicht gespeichert', error.message);
      }, 800);
    },
    [uid],
  );

  return [order, save] as const;
}
