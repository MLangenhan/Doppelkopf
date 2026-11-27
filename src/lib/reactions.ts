import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sound } from './sound';
import { supabase } from './supabase';
import { playBoardSound, SOUNDS } from './soundboard';

// Schnelle Reaktionen am Tisch (Applaus, Autsch …). Laufen über einen Realtime-Broadcast pro Tisch,
// im Übungsmodus nur lokal.

export type ReactionKind = 'applaus' | 'autsch' | 'glueck' | 'hmm' | 'hoert' | 'fuchs' | 'brille' | 'ehrenrunde';
/** Grundreaktionen (Tasten 1–4); dazu kommen die durch Erfolge freigeschalteten */
export const REACTION_KINDS: ReactionKind[] = ['applaus', 'autsch', 'glueck', 'hmm'];
export const EXTRA_REACTION_KINDS: ReactionKind[] = ['hoert', 'fuchs', 'brille', 'ehrenrunde'];
export const REACTION_LABELS: Record<ReactionKind, string> = {
  applaus: 'Applaus',
  autsch: 'Autsch',
  glueck: 'Glück gehabt',
  hmm: 'Hmm …',
  hoert: 'Hört, hört!',
  fuchs: 'Fuchs!',
  brille: 'Brille auf',
  ehrenrunde: 'Ehrenrunde',
};

export interface ShownReaction {
  kind: ReactionKind | 'sound';
  id: number;
  /** Soundboard: Name des Sounds */
  label?: string;
}

const SHOW_MS = 2600;
const MIN_GAP_MS = 900;
/** Soundboard: höchstens ein Sound alle 1,5 Sekunden pro Person */
const SOUND_GAP_MS = 1500;
let nextId = 1;

export function useReactions(tableId: string | null, me: string | null) {
  const [shown, setShown] = useState<Record<string, ShownReaction>>({});
  const channel = useRef<RealtimeChannel | null>(null);
  const last = useRef(0);

  const show = useCallback((uid: string, kind: ReactionKind) => {
    if (!REACTION_KINDS.includes(kind) && !EXTRA_REACTION_KINDS.includes(kind)) return;
    const id = nextId++;
    setShown((cur) => ({ ...cur, [uid]: { kind, id } }));
    sound.reaction(kind);
    setTimeout(() => setShown((cur) => (cur[uid]?.id === id ? (({ [uid]: _gone, ...rest }) => rest)(cur) : cur)), SHOW_MS);
  }, []);

  // Soundboard: kurz am Platz anzeigen, wer was abspielt, und den Sound abspielen
  const lastSoundFrom = useRef<Record<string, number>>({});
  const showSound = useCallback((uid: string, idx: number) => {
    const s = SOUNDS[idx];
    if (!s) return;
    // Spam-Schutz auch beim Empfangen
    const now = Date.now();
    if (now - (lastSoundFrom.current[uid] ?? 0) < SOUND_GAP_MS - 200) return;
    lastSoundFrom.current[uid] = now;
    const id = nextId++;
    setShown((cur) => ({ ...cur, [uid]: { kind: 'sound', id, label: s.label } }));
    playBoardSound(idx);
    setTimeout(() => setShown((cur) => (cur[uid]?.id === id ? (({ [uid]: _gone, ...rest }) => rest)(cur) : cur)), SHOW_MS);
  }, []);

  useEffect(() => {
    if (!tableId || !me) return;
    const ch = supabase.channel(`react:${tableId}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'r' }, ({ payload }) => {
      const p = payload as { from?: string; kind?: ReactionKind };
      if (p.from && p.kind) show(p.from, p.kind);
    })
      .on('broadcast', { event: 's' }, ({ payload }) => {
        const p = payload as { from?: string; idx?: number };
        if (p.from && typeof p.idx === 'number') showSound(p.from, p.idx);
      })
      .subscribe();
    channel.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channel.current = null;
    };
  }, [tableId, me, show, showSound]);

  const send = useCallback(
    (kind: ReactionKind) => {
      if (!me) return;
      const now = Date.now();
      if (now - last.current < MIN_GAP_MS) return;
      last.current = now;
      show(me, kind);
      void channel.current?.send({ type: 'broadcast', event: 'r', payload: { from: me, kind } });
    },
    [me, show],
  );

  const lastSound = useRef(0);
  const sendSound = useCallback(
    (idx: number) => {
      if (!me) return;
      const now = Date.now();
      if (now - lastSound.current < SOUND_GAP_MS) return;
      lastSound.current = now;
      showSound(me, idx);
      void channel.current?.send({ type: 'broadcast', event: 's', payload: { from: me, idx } });
    },
    [me, showSound],
  );

  return { shown, send, sendSound };
}
