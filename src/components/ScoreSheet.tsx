import { motion } from 'motion/react';
import { useMemo } from 'react';
import { resultKindLabel } from '../lib/gameText';
import type { Member, ResultRow } from '../lib/supabase';

/** Punkteliste des Abends: eine Spalte pro Spieler, eine Zeile pro Spiel. */
export function ScoreSheet({ results, members, me }: { results: ResultRow[]; members: Member[]; me: string | null }) {
  const { players, rows, totals } = useMemo(() => {
    const names = new Map(members.map((m) => [m.user_id, m.display_name]));
    const ids = [...new Set([...members.map((m) => m.user_id), ...results.map((r) => r.user_id)])];
    const byGame = new Map<string, ResultRow[]>();
    for (const r of [...results].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      byGame.set(r.game_id, [...(byGame.get(r.game_id) ?? []), r]);
    }
    const totals = new Map<string, number>();
    const rows = [...byGame.entries()].map(([gameId, rs], i) => {
      for (const r of rs) totals.set(r.user_id, (totals.get(r.user_id) ?? 0) + r.points);
      const soloist = rs.find((r) => r.is_soloist);
      return {
        gameId,
        n: i + 1,
        kind: resultKindLabel(rs[0].kind, rs[0].solo),
        soloist: soloist?.user_id,
        points: new Map(rs.map((r) => [r.user_id, r.points])),
        running: new Map(totals),
      };
    });
    return {
      players: ids.map((id) => ({ id, name: names.get(id) ?? 'Ehemalig' })),
      rows: rows.reverse(),
      totals,
    };
  }, [results, members]);

  if (!rows.length) {
    return <p className="px-1 text-sm text-white/50">Noch keine Spiele gewertet.</p>;
  }

  const leader = Math.max(...players.map((p) => totals.get(p.id) ?? 0));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-white/60">
            <th className="w-8 py-1 text-left font-medium">#</th>
            {players.map((p) => (
              <th key={p.id} className={`max-w-16 truncate px-1 py-1 text-right font-medium ${p.id === me ? 'text-gold-300' : ''}`}>
                {p.name}
              </th>
            ))}
          </tr>
          <tr className="border-b border-white/15">
            <th className="py-1.5 text-left text-xs font-semibold text-white/50">Σ</th>
            {players.map((p) => {
              const t = totals.get(p.id) ?? 0;
              return (
                <th key={p.id} className="px-1 py-1.5 text-right">
                  <motion.span
                    key={t}
                    initial={{ scale: 1.4, color: '#f6dc8c' }}
                    animate={{ scale: 1, color: t === leader && t > 0 ? '#f6dc8c' : '#ffffff' }}
                    className="inline-block font-mono text-base font-bold"
                  >
                    {t}
                  </motion.span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.gameId} className="border-b border-white/5 last:border-0">
              <td className="py-1 text-xs text-white/45" title={row.kind}>
                {row.n}
              </td>
              {players.map((p) => {
                const pts = row.points.get(p.id);
                return (
                  <td
                    key={p.id}
                    className={`px-1 py-1 text-right font-mono ${
                      pts === undefined ? 'text-white/25' : pts > 0 ? 'text-emerald-300' : pts < 0 ? 'text-red-300' : 'text-white/60'
                    } ${row.soloist === p.id ? 'font-bold underline decoration-gold-400 decoration-2 underline-offset-2' : ''}`}
                    title={row.soloist === p.id ? `${row.kind} (Solist)` : row.kind}
                  >
                    {pts === undefined ? '–' : pts > 0 ? `+${pts}` : pts}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-white/40">Unterstrichen = Solo. „–“ = hat ausgesetzt.</p>
    </div>
  );
}
