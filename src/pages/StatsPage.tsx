import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionLabel } from '../components/SectionLabel';
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
      <main className="mx-auto max-w-5xl px-4 pt-4 pb-20">
        <p className="tag text-[11px] text-white/45">
          <span className="text-gold-400">Rangliste</span> / über alle Abende
        </p>
        <h1 className="display mt-2 text-7xl sm:text-8xl">Statistik</h1>

        <section className="mt-10 border-t border-white/[0.08] py-10">
          <SectionLabel n="01">Spieler</SectionLabel>
          {stats === null ? (
            <p className="tag text-[11px] text-white/40">Lädt …</p>
          ) : stats.length === 0 ? (
            <p className="text-white/50">Noch keine gewerteten Spiele.</p>
          ) : (
            <ol className="border-t border-white/[0.08]">
              {stats.map((s, i) => (
                <motion.li
                  key={s.user_id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 border-b border-white/[0.08] py-5"
                >
                  <span className={`tag text-xs ${i === 0 ? 'text-gold-400' : 'text-white/35'}`}>{String(i + 1).padStart(2, '0')}</span>
                  <div className="min-w-0">
                    <div className={`truncate text-xl font-medium ${s.user_id === me ? 'text-gold-300' : 'text-white'}`}>
                      {s.display_name}
                    </div>
                    <div className="tag mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/40">
                      <span>{s.games} Spiele</span>
                      <span>{pct(s.wins, s.games)} gewonnen</span>
                      <span>Re {pct(s.re_wins, s.re_games)}</span>
                      <span>Ø {(s.points / s.games).toFixed(2)}</span>
                      <span>
                        {s.solos} {s.solos === 1 ? 'Solo' : 'Soli'}
                        {s.solos > 0 && ` · ${s.solos_won} gew.`}
                      </span>
                      <span>
                        {s.evenings} {s.evenings === 1 ? 'Abend' : 'Abende'}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`display text-5xl tabular-nums ${s.points > 0 ? 'text-emerald-300' : s.points < 0 ? 'text-red-300' : 'text-white/60'}`}
                  >
                    {s.points > 0 ? `+${s.points}` : s.points}
                  </span>
                </motion.li>
              ))}
            </ol>
          )}
        </section>

        <section className="border-t border-white/[0.08] py-10">
          <SectionLabel n="02">Abende</SectionLabel>
          {evenings.length === 0 ? (
            <p className="text-white/50">Noch keine Abende.</p>
          ) : (
            <ul className="border-t border-white/[0.08]">
              {evenings.map(({ table, totals, games }) => (
                <li key={table.id}>
                  <Link
                    to={`/t/${table.code}`}
                    data-cursor="Öffnen"
                    className="group grid grid-cols-[6.5rem_1fr] gap-x-4 gap-y-2 border-b border-white/[0.08] py-5 transition-colors hover:bg-white/[0.03] sm:grid-cols-[7rem_1fr_auto]"
                  >
                    <span className="tag text-[11px] text-white/40">{new Date(table.created_at).toLocaleDateString('de-DE')}</span>
                    <div className="min-w-0">
                      <div className="truncate text-lg font-medium transition-colors group-hover:text-gold-300">{table.name}</div>
                      <div className="mt-1 text-sm text-white/55">
                        {totals.map(([uid, pts], i) => (
                          <span key={uid}>
                            {i > 0 && <span className="px-1.5 text-white/20">/</span>}
                            <span className={i === 0 && pts > 0 ? 'text-gold-300' : undefined}>{names.get(uid) ?? '?'}</span>{' '}
                            <span className="tabular-nums text-white/40">{pts > 0 ? `+${pts}` : pts}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="tag col-start-2 text-[11px] text-white/35 sm:col-start-auto">{games} Spiele</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
