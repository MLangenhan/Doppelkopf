import { ACHIEVEMENTS, achievementPoints, achievementProgress, RARITIES, type Rarity, type ResultLite } from '@engine';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { AchievementBadge } from '../components/AchievementBadge';
import { TopBar } from '../components/TopBar';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

interface Earned {
  user_id: string;
  key: string;
  earned_at: string;
}

const ORDER: Rarity[] = ['mythic', 'legendary', 'epic', 'rare', 'common'];
const RESULT_COLS = 'user_id, game_id, table_id, points, won, kind, solo, is_soloist, created_at';

/** Übersicht aller Erfolge: freigeschaltet, Fortschritt, wie selten sie in der Runde sind, Punkte */
export function AchievementsPage() {
  const { session } = useAuth();
  const me = session?.user.id ?? null;
  const [all, setAll] = useState<Earned[] | null>(null);
  const [players, setPlayers] = useState(0);
  const [progress, setProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!me) return;
    (async () => {
      const [{ data: earned }, { count }, { data: mine }, { data: fox }] = await Promise.all([
        supabase.from('user_achievements').select('user_id, key, earned_at'),
        supabase.from('player_stats').select('user_id', { count: 'exact', head: true }).gt('games', 0),
        supabase.from('game_results').select(RESULT_COLS).eq('user_id', me).order('created_at'),
        supabase.from('user_counters').select('value').eq('user_id', me).eq('key', 'fox').maybeSingle(),
      ]);
      setAll((earned ?? []) as Earned[]);
      setPlayers(count ?? 0);
      const rows = (mine ?? []) as ResultLite[];
      const tableIds = [...new Set(rows.map((r) => r.table_id))];
      const { data: tables } = tableIds.length
        ? await supabase.from('game_results').select(RESULT_COLS).in('table_id', tableIds)
        : { data: [] };
      setProgress(achievementProgress(me, { mine: rows, tables: (tables ?? []) as ResultLite[], foxes: fox?.value ?? 0 }));
    })();
  }, [me]);

  const mineEarned = useMemo(() => new Map((all ?? []).filter((e) => e.user_id === me).map((e) => [e.key, e])), [all, me]);
  const holders = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of all ?? []) m.set(e.key, (m.get(e.key) ?? 0) + 1);
    return m;
  }, [all]);
  const points = achievementPoints(mineEarned.keys());
  const maxPoints = achievementPoints(ACHIEVEMENTS.map((a) => a.key));

  return (
    <div className="felt min-h-full">
      <TopBar />
      <main className="mx-auto max-w-5xl px-4 pt-4 pb-20">
        <p className="tag text-[11px] text-white/45">
          <span className="text-gold-400">Erfolge</span> / {mineEarned.size} von {ACHIEVEMENTS.length} freigeschaltet
        </p>
        <h1 className="display mt-2 text-6xl sm:text-8xl">Erfolge</h1>
        <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-2">
          <div>
            <div className="tag text-[10px] text-white/45">Erfolgspunkte</div>
            <div className="display text-5xl text-gold-300 tabular-nums">{points}</div>
          </div>
          <div className="min-w-48 flex-1">
            <div className="h-2 rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full bg-gold-400" style={{ width: `${(points / maxPoints) * 100}%` }} />
            </div>
            <div className="tag mt-1 text-[10px] text-white/40">
              {points} / {maxPoints} · Gewertet werden nur Spiele an Tischen ohne Bots
            </div>
          </div>
        </div>

        {ORDER.map((rarity) => (
          <section key={rarity} className="mt-10 border-t border-white/[0.08] pt-6">
            <h2 className="tag mb-4 flex items-center gap-3 text-[11px] text-white/60">
              <span className={rarity === 'mythic' ? 'text-fuchsia-300' : rarity === 'legendary' ? 'text-sky-300' : rarity === 'epic' ? 'text-yellow-300' : rarity === 'rare' ? 'text-slate-200' : 'text-amber-500'}>
                {RARITIES[rarity].label}
              </span>
              <span className="text-white/35">je {RARITIES[rarity].points} Punkte</span>
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ACHIEVEMENTS.filter((a) => a.rarity === rarity).map((a, i) => {
                const earned = mineEarned.get(a.key);
                const count = holders.get(a.key) ?? 0;
                const hidden = a.secret && !earned && count === 0;
                const prog = a.target ? Math.min(a.target, progress[a.key] ?? 0) : null;
                return (
                  <motion.li
                    key={a.key}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`flex items-center gap-4 rounded-xl p-3 ring-1 ${earned ? 'bg-white/[0.06] ring-white/15' : 'bg-white/[0.02] ring-white/[0.06]'}`}
                  >
                    <AchievementBadge achievementKey={a.key} size={60} locked={!earned} />
                    <div className="min-w-0 flex-1">
                      <div className={`font-semibold ${earned ? 'text-white' : 'text-white/60'}`}>{hidden ? '???' : a.name}</div>
                      <div className="text-xs text-white/50">{hidden ? 'Geheimer Erfolg' : a.description}</div>
                      {prog !== null && !earned && (
                        <div className="mt-1.5">
                          <div className="h-1 rounded-full bg-white/[0.08]">
                            <div className="h-full rounded-full bg-gold-400/80" style={{ width: `${(prog / a.target!) * 100}%` }} />
                          </div>
                          <div className="tag mt-0.5 text-[9px] text-white/40">
                            {prog} / {a.target}
                          </div>
                        </div>
                      )}
                      <div className="tag mt-1 text-[9px] text-white/35">
                        {earned ? `Freigeschaltet ${new Date(earned.earned_at).toLocaleDateString('de-DE')} · ` : ''}
                        {players ? `${Math.round((count / players) * 100)} % der Runde` : ''}
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </section>
        ))}
        {all === null && <p className="tag mt-6 text-[11px] text-white/40">Lädt …</p>}
      </main>
    </div>
  );
}
