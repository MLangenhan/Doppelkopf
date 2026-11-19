import { useEffect, useState } from 'react';
import { useAuth } from './auth';
import { supabase } from './supabase';

// Eigene Erfolge (für Freischaltungen wie Kartenrücken oder Reaktionen), einmal pro Sitzung geladen
let cache: { uid: string; keys: Promise<Set<string>> } | null = null;

export function useMyAchievements(): Set<string> {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const [keys, setKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!uid) return;
    if (!cache || cache.uid !== uid) {
      cache = {
        uid,
        keys: Promise.resolve(supabase.from('user_achievements').select('key').eq('user_id', uid)).then(
          ({ data }) => new Set((data ?? []).map((r) => r.key as string)),
        ),
      };
    }
    let alive = true;
    void cache.keys.then((k) => alive && setKeys(k));
    return () => {
      alive = false;
    };
  }, [uid]);
  return keys;
}

/** Nach neuen Erfolgen frisch laden */
export function refreshMyAchievements() {
  cache = null;
}
