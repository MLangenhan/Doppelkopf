import { useEffect, useRef } from 'react';
import { useAuth } from './auth';
import { getPrefs, type Prefs, setPref, usePrefs } from './prefs';
import { supabase } from './supabase';

// Kartenrücken, Filzfarbe und Konfetti im Profil speichern, damit sie auf jedem Gerät gelten
const KEYS = ['cardBack', 'felt', 'confetti'] as const;
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
          for (const k of KEYS) if (typeof p[k] === 'string' && p[k] !== getPrefs()[k]) setPref(k, p[k] as string);
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
