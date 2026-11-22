import type { TrumpMode } from '@engine';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useAuth } from './auth';
import { type FaceOrder, faceOrderKey, normalizeFaceOrder } from './handSort';
import { supabase } from './supabase';

// Eigene Kartenreihenfolge: im Profil gespeichert (gilt auf jedem Gerät), dazu im Browser zwischengespeichert,
// damit sie sofort da ist – auch im Übungsmodus ohne Konto. Ein gemeinsamer Stand für alle Komponenten.
// Pro Spielart (Normalspiel, Damensolo, Fleischloser, Farbsoli …) eine eigene Reihenfolge.

type FaceOrders = Record<string, FaceOrder>;

const KEY = 'doko:cardOrder';
const listeners = new Set<() => void>();
let current: FaceOrders = readLocal();
let loadedFor: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Alte Speicherstände (eine Liste) gelten fürs Normalspiel */
function parse(raw: unknown): FaceOrders | null {
  if (Array.isArray(raw)) {
    const o = normalizeFaceOrder(raw);
    return o ? { normal: o } : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const out: FaceOrders = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const o = normalizeFaceOrder(v, k as TrumpMode);
    if (o) out[k] = o;
  }
  return out;
}

function readLocal(): FaceOrders {
  try {
    const raw = localStorage.getItem(KEY);
    return (raw && parse(JSON.parse(raw))) || {};
  } catch {
    return {};
  }
}

function set(orders: FaceOrders) {
  current = orders;
  try {
    localStorage.setItem(KEY, JSON.stringify(orders));
  } catch {
    // ohne Speicher gilt sie bis zum Neuladen
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function useOrders() {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const orders = useSyncExternalStore(subscribe, () => current, () => current);

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
        const remote = parse(data?.card_order);
        if (remote && Object.keys(remote).length) set(remote);
      });
  }, [uid]);

  const save = useCallback(
    (next: FaceOrders) => {
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
  return [orders, save] as const;
}

/** Eigene Reihenfolge für eine Spielart (null = noch keine) */
export function useCardOrder(mode: TrumpMode) {
  const [orders, saveAll] = useOrders();
  const key = faceOrderKey(mode);
  const save = useCallback((next: FaceOrder) => saveAll({ ...current, [key]: next }), [saveAll, key]);
  return [orders[key] ?? null, save] as const;
}

/** Für die Einstellungen: gibt es überhaupt eigene Reihenfolgen, und alle zurücksetzen */
export function useAllCardOrders() {
  const [orders, saveAll] = useOrders();
  return { any: Object.keys(orders).length > 0, reset: () => saveAll({}) };
}
