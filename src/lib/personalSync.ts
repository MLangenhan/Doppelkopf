import { useEffect, useRef } from 'react';
import { useAuth } from './auth';
import { getPrefs, type Prefs, setPref, usePrefs } from './prefs';
import { supabase } from './supabase';

// Kartenrücken, Filzfarbe, Konfetti und Lernstand im Profil speichern, damit sie auf jedem Gerät gelten
const KEYS = ['cardBack', 'felt', 'confetti', 'learnLevel', 'spectatorLearn'] as const;
type Personal = Pick<Prefs, (typeof KEYS)[number]>;

export function usePersonalSync() {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const [prefs] = usePrefs();
  const loaded = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Beim Anmelden: Profil gewinnt gegen den Browser
  useEffect(() => {
    if (!uid) return;
    void supabase
      .from('profiles')
      .select('personal')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error) {
          const p = (data?.personal ?? {}) as Partial<Personal>;
          for (const k of KEYS) if (p[k] !== undefined && typeof p[k] === typeof getPrefs()[k] && p[k] !== getPrefs()[k]) setPref(k, p[k] as never);
        }
        loaded.current = uid;
      });
  }, [uid]);

  // Änderungen kurz danach ins Profil schreiben
  const value = JSON.stringify(Object.fromEntries(KEYS.map((k) => [k, prefs[k]])));
  useEffect(() => {
    if (!uid || loaded.current !== uid) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void supabase.from('profiles').update({ personal: JSON.parse(value) }).eq('id', uid);
    }, 800);
  }, [uid, value]);
}
