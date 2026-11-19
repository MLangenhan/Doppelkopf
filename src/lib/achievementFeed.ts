import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface AchievementEvent {
  id: number;
  userId: string;
  key: string;
}

let nextId = 1;

/** Neue Erfolge an diesem Tisch, live über Realtime; werden nacheinander angezeigt */
export function useAchievementFeed(tableId: string | null) {
  const [queue, setQueue] = useState<AchievementEvent[]>([]);

  useEffect(() => {
    if (!tableId) return;
    const ch = supabase
      .channel(`achievements:${tableId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_achievements', filter: `table_id=eq.${tableId}` },
        (p) => {
          const row = p.new as { user_id?: string; key?: string };
          if (row.user_id && row.key) setQueue((q) => [...q, { id: nextId++, userId: row.user_id!, key: row.key! }]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [tableId]);

  const done = useCallback((id: number) => setQueue((q) => q.filter((e) => e.id !== id)), []);
  return { current: queue[0] ?? null, done };
}
