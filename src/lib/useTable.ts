import type { Card, GameAction } from '@engine';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './auth';
import { api, displayOf, NAMETAG_COLS, type GameRow, type Member, type ResultRow, supabase, type TableRow } from './supabase';

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
  /** Wer aussetzt: Hände der Spieler (user_id → Karten) des laufenden Spiels */
  const [others, setOthers] = useState<{ gameId: string; hands: Record<string, HandEntry> } | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [finished, setFinished] = useState<GameRow[]>([]);
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
      .select(`user_id, seat, profiles(display_name, ${NAMETAG_COLS})`)
      .eq('table_id', tableId)
      .order('seat');
    setMembers(
      (data ?? []).map((m) => ({
        user_id: m.user_id as string,
        seat: m.seat as number,
        display_name: (m.profiles as unknown as { display_name: string } | null)?.display_name ?? '?',
        ...displayOf(m.profiles as unknown as Parameters<typeof displayOf>[0]),
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
      // Alle anderen Hände kommen nur zurück, wenn ich aussetze (RLS)
      const { data: rest } = await supabase.from('game_hands').select('user_id, cards, version').eq('game_id', gameId).neq('user_id', me);
      setOthers(
        rest && rest.length
          ? { gameId, hands: Object.fromEntries(rest.map((r) => [r.user_id as string, { cards: r.cards as Card[], version: r.version as number }])) }
          : null,
      );
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
    const [{ data }, { data: games }] = await Promise.all([
      supabase.from('game_results').select('*').eq('table_id', tableId),
      // Fertige Spiele mit Abrechnung (für die Punkte-Aufschlüsselung)
      supabase
        .from('games')
        .select('*')
        .eq('table_id', tableId)
        .eq('status', 'finished')
        .order('number', { ascending: false })
        .limit(30),
    ]);
    setResults((data ?? []) as ResultRow[]);
    setFinished((games ?? []) as GameRow[]);
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
        // Zuschauer: Hände bei jeder Spieländerung frisch holen (Realtime auf fremde Hände ist unzuverlässig)
        if (p.eventType === 'INSERT' || (me && !(row.players ?? []).includes(me))) loadHand(row.id);
        if (row.status === 'finished') loadResults(tableId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_hands' }, (p) => {
        const row = p.new as { game_id: string; user_id: string; cards: Card[]; version: number };
        if (!row?.game_id) return;
        const entry = { cards: row.cards, version: row.version };
        if (row.user_id === me) return acceptHand(row.game_id, entry);
        setOthers((cur) => {
          const base = cur?.gameId === row.game_id ? cur.hands : {};
          if ((base[row.user_id]?.version ?? -1) > entry.version) return cur;
          return { gameId: row.game_id, hands: { ...base, [row.user_id]: entry } };
        });
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
  const otherHands =
    game && others?.gameId === game.id && me && !game.players.includes(me)
      ? Object.fromEntries(Object.entries(others.hands).map(([u, h]) => [u, h.cards]))
      : undefined;

  /** Nur den Spielstand nachladen (z. B. nach einem Bot-Zug, falls Realtime hängt) */
  const reloadGame = useCallback(async () => {
    const t = tableRef.current;
    if (t) await Promise.all([loadGame(t.id), loadResults(t.id)]);
  }, [loadGame, loadResults]);

  return { me, table, members, game, hand, otherHands, results, finished, error, loading, act, startGame, refresh, reloadGame };
}
