import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sound } from './sound';
import { supabase } from './supabase';

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
  kind: ReactionKind;
  id: number;
}

const SHOW_MS = 2600;
const MIN_GAP_MS = 900;
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

  useEffect(() => {
    if (!tableId || !me) return;
    const ch = supabase.channel(`react:${tableId}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'r' }, ({ payload }) => {
      const p = payload as { from?: string; kind?: ReactionKind };
      if (p.from && p.kind) show(p.from, p.kind);
    }).subscribe();
    channel.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channel.current = null;
    };
  }, [tableId, me, show]);

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

  return { shown, send };
}
