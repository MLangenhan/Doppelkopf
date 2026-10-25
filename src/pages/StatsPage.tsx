import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { useAuth } from '../lib/auth';
import { type ResultRow, supabase, type TableRow } from '../lib/supabase';

interface PlayerStats {
  user_id: string;
  display_name: string;
  games: number;
  wins: number;
  points: number;
  solos: number;
  solos_won: number;
  re_games: number;
  re_wins: number;
  evenings: number;
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '–');

export function StatsPage() {
  const { session } = useAuth();
  const me = session?.user.id;
  const [stats, setStats] = useState<PlayerStats[] | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: r }] = await Promise.all([
        supabase.from('player_stats').select('*').gt('games', 0).order('points', { ascending: false }),
        supabase.from('game_results').select('*').order('created_at', { ascending: false }).limit(5000),
      ]);
      setStats((s ?? []) as PlayerStats[]);
      const rows = (r ?? []) as ResultRow[];
      setResults(rows);
      const ids = [...new Set(rows.map((x) => x.table_id))];
      if (ids.length) {
        const { data: t } = await supabase.from('tables').select('*').in('id', ids);
        setTables((t ?? []) as TableRow[]);
      }
    })();
  }, []);

  const names = useMemo(() => new Map((stats ?? []).map((s) => [s.user_id, s.display_name])), [stats]);

  const evenings = useMemo(() => {
    const byTable = new Map<string, Map<string, number>>();
    const gamesPerTable = new Map<string, Set<string>>();
    for (const r of results) {
      const m = byTable.get(r.table_id) ?? new Map<string, number>();
      m.set(r.user_id, (m.get(r.user_id) ?? 0) + r.points);
      byTable.set(r.table_id, m);
      gamesPerTable.set(r.table_id, (gamesPerTable.get(r.table_id) ?? new Set()).add(r.game_id));
    }
    return tables
      .map((t) => {
        const totals = [...(byTable.get(t.id) ?? new Map()).entries()].sort((a, b) => b[1] - a[1]);
        return { table: t, totals, games: gamesPerTable.get(t.id)?.size ?? 0 };
      })
      .sort((a, b) => b.table.created_at.localeCompare(a.table.created_at));
  }, [results, tables]);

  return (
    <div className="felt min-h-full">
      <TopBar />
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-16">
        <h1 className="font-display text-3xl font-bold">Statistik</h1>
        <p className="mt-1 text-white/60">Über alle Abende hinweg.</p>

        <section className="panel mt-6 overflow-x-auto p-2 sm:p-4">
          {stats === null ? (
            <p className="p-4 text-white/50">Lädt …</p>
          ) : stats.length === 0 ? (
            <p className="p-4 text-white/50">Noch keine gewerteten Spiele.</p>
          ) : (
            <table className="w-full min-w-[640px] text-sm tabular-nums">
              <thead>
                <tr className="border-b border-white/15 text-left text-white/60">
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">Spieler</th>
                  <th className="px-2 py-2 text-right font-medium">Punkte</th>
                  <th className="px-2 py-2 text-right font-medium">Ø / Spiel</th>
                  <th className="px-2 py-2 text-right font-medium">Spiele</th>
                  <th className="px-2 py-2 text-right font-medium">Gewonnen</th>
                  <th className="px-2 py-2 text-right font-medium">Re gewonnen</th>
                  <th className="px-2 py-2 text-right font-medium">Soli</th>
                  <th className="px-2 py-2 text-right font-medium">Abende</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s, i) => (
                  <motion.tr
                    key={s.user_id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`border-b border-white/5 last:border-0 ${s.user_id === me ? 'bg-gold-400/10' : ''}`}
                  >
                    <td className="px-2 py-2 text-white/50">{i === 0 ? '🏆' : i + 1}</td>
                    <td className="px-2 py-2 font-semibold">{s.display_name}</td>
                    <td className={`px-2 py-2 text-right font-mono font-bold ${s.points > 0 ? 'text-emerald-300' : s.points < 0 ? 'text-red-300' : ''}`}>
                      {s.points > 0 ? `+${s.points}` : s.points}
                    </td>
                    <td className="px-2 py-2 text-right font-mono">{(s.points / s.games).toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{s.games}</td>
                    <td className="px-2 py-2 text-right">{pct(s.wins, s.games)}</td>
                    <td className="px-2 py-2 text-right">{pct(s.re_wins, s.re_games)}</td>
                    <td className="px-2 py-2 text-right">
                      {s.solos} {s.solos > 0 && <span className="text-white/50">({s.solos_won} gew.)</span>}
                    </td>
                    <td className="px-2 py-2 text-right">{s.evenings}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <h2 className="mt-10 text-lg font-semibold">Abende</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {evenings.map(({ table, totals, games }) => (
            <li key={table.id}>
              <Link to={`/t/${table.code}`} className="panel block p-4 transition hover:border-gold-400/50">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{table.name}</span>
                  <span className="text-xs text-white/50">
                    {new Date(table.created_at).toLocaleDateString('de-DE')} · {games} Spiele
                  </span>
                </div>
                <ol className="mt-2 space-y-0.5 text-sm">
                  {totals.map(([uid, pts], i) => (
                    <li key={uid} className="flex justify-between">
                      <span className={uid === me ? 'text-gold-300' : 'text-white/80'}>
                        {i === 0 && pts > 0 ? '🏆 ' : ''}
                        {names.get(uid) ?? '?'}
                      </span>
                      <span className="font-mono">{pts > 0 ? `+${pts}` : pts}</span>
                    </li>
                  ))}
                </ol>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
