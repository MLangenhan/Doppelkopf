import type { Card, GameAction } from '@engine';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './auth';
import { api, type GameRow, type Member, type ResultRow, supabase, type TableRow } from './supabase';

interface HandEntry {
  cards: Card[];
  version: number;
}

/**
 * Lädt einen Tisch samt Mitspielern, aktuellem Spiel, eigener Hand und Ergebnissen
 * und hält alles per Supabase Realtime aktuell.
 */
export function useTable(code: string) {
  const { session } = useAuth();
  const me = session?.user.id ?? null;

  const [table, setTable] = useState<TableRow | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [game, setGame] = useState<GameRow | null>(null);
  const [hands, setHands] = useState<Record<string, HandEntry>>({});
  const [results, setResults] = useState<ResultRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const tableRef = useRef<TableRow | null>(null);
  tableRef.current = table;

  /** Übernimmt einen Spielstand nur, wenn er neuer ist als der bekannte. */
  const acceptGame = useCallback((row: GameRow | null) => {
    if (!row) return;
    setGame((cur) => {
      if (!cur) return row;
      if (row.number > cur.number) return row;
      if (row.id === cur.id && row.version >= cur.version) return row;
      return cur;
    });
  }, []);

  const acceptHand = useCallback((gameId: string, entry: HandEntry) => {
    setHands((cur) => {
      const old = cur[gameId];
      if (old && old.version > entry.version) return cur;
      return { ...cur, [gameId]: entry };
    });
  }, []);

  const loadMembers = useCallback(async (tableId: string) => {
    const { data } = await supabase
      .from('table_players')
      .select('user_id, seat, profiles(display_name)')
      .eq('table_id', tableId)
      .order('seat');
    setMembers(
      (data ?? []).map((m) => ({
        user_id: m.user_id as string,
        seat: m.seat as number,
        display_name: (m.profiles as unknown as { display_name: string } | null)?.display_name ?? '?',
      })),
    );
  }, []);

  const loadHand = useCallback(
    async (gameId: string) => {
      if (!me) return;
      const { data } = await supabase
        .from('game_hands')
        .select('cards, version')
        .eq('game_id', gameId)
        .eq('user_id', me)
        .maybeSingle();
      if (data) acceptHand(gameId, { cards: data.cards as Card[], version: data.version as number });
    },
    [me, acceptHand],
  );

  const loadGame = useCallback(
    async (tableId: string) => {
      const { data } = await supabase
        .from('games')
        .select('*')
        .eq('table_id', tableId)
        .order('number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        acceptGame(data as GameRow);
        await loadHand(data.id as string);
      }
    },
    [acceptGame, loadHand],
  );

  const loadResults = useCallback(async (tableId: string) => {
    const { data } = await supabase.from('game_results').select('*').eq('table_id', tableId);
    setResults((data ?? []) as ResultRow[]);
  }, []);

  const refresh = useCallback(async () => {
    const t = tableRef.current;
    if (!t) return;
    const { data } = await supabase.from('tables').select('*').eq('id', t.id).maybeSingle();
    if (data) setTable(data as TableRow);
    await Promise.all([loadMembers(t.id), loadGame(t.id), loadResults(t.id)]);
  }, [loadMembers, loadGame, loadResults]);

  // Erstes Laden (inkl. automatischem Beitreten über den Einladungslink)
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const normalized = code.trim().toUpperCase();
        let { data: t } = await supabase.from('tables').select('*').eq('code', normalized).maybeSingle();
        if (!t) throw new Error('Diesen Tisch gibt es nicht.');
        const { data: seat } = await supabase
          .from('table_players')
          .select('seat')
          .eq('table_id', t.id)
          .eq('user_id', me)
          .maybeSingle();
        if (!seat) t = await api.joinTable(normalized);
        if (cancelled) return;
        setTable(t as TableRow);
        tableRef.current = t as TableRow;
        await Promise.all([loadMembers(t!.id), loadGame(t!.id), loadResults(t!.id)]);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, me, loadMembers, loadGame, loadResults]);

  // Realtime
  const tableId = table?.id;
  useEffect(() => {
    if (!tableId || !me) return;
    let firstSubscribe = true;
    const channel = supabase
      .channel(`table-db:${tableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_players', filter: `table_id=eq.${tableId}` }, () =>
        loadMembers(tableId),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tables', filter: `id=eq.${tableId}` }, (p) =>
        setTable(p.new as TableRow),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `table_id=eq.${tableId}` }, (p) => {
        const row = p.new as GameRow;
        if (!row?.id) return;
        acceptGame(row);
        if (p.eventType === 'INSERT') loadHand(row.id);
        if (row.status === 'finished') loadResults(tableId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_hands', filter: `user_id=eq.${me}` }, (p) => {
        const row = p.new as { game_id: string; cards: Card[]; version: number };
        if (row?.game_id) acceptHand(row.game_id, { cards: row.cards, version: row.version });
      })
      .subscribe((status) => {
        // Nach einem Reconnect alles neu laden, um verpasste Änderungen nachzuholen
        if (status === 'SUBSCRIBED') {
          if (!firstSubscribe) refresh();
          firstSubscribe = false;
        }
      });

    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [tableId, me, loadMembers, loadHand, loadResults, acceptGame, acceptHand, refresh]);

  const act = useCallback(
    async (action: GameAction) => {
      if (!game) return;
      await api.act(game.id, action);
      // Falls Realtime hängt: Stand direkt nachladen
      const { data } = await supabase.from('games').select('*').eq('id', game.id).single();
      if (data) acceptGame(data as GameRow);
      await loadHand(game.id);
      if (data?.status === 'finished' && tableRef.current) await loadResults(tableRef.current.id);
    },
    [game, acceptGame, loadHand, loadResults],
  );

  const startGame = useCallback(async () => {
    if (!table) return;
    try {
      await api.startGame(table.id);
    } catch (e) {
      // Jemand anderes war schneller – kein Fehler
      if (!(e as Error).message.includes('läuft bereits')) throw e;
    }
    await loadGame(table.id);
  }, [table, loadGame]);

  const hand = game ? (hands[game.id]?.cards ?? []) : [];

  return { me, table, members, game, hand, results, error, loading, act, startGame, refresh };
}
