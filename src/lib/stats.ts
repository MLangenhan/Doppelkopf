import type { ResultRow } from './supabase';

export interface Tally {
  games: number;
  wins: number;
  points: number;
}

export interface PlayerDetail {
  total: Tally;
  re: Tally;
  kontra: Tally;
  /** Nach Spielart (Normal, Hochzeit, Armut, je Solo …), häufigste zuerst */
  kinds: { key: string; kind: string; solo: string | null; soloist: boolean; tally: Tally }[];
  /** Punktestand nach jedem Spiel, älteste zuerst */
  timeline: { at: string; points: number; total: number }[];
  /** Mit wem in derselben Partei gespielt */
  partners: { userId: string; tally: Tally }[];
  best: ResultRow | null;
  worst: ResultRow | null;
  /** Längste Siegesserie */
  streak: number;
}

const empty = (): Tally => ({ games: 0, wins: 0, points: 0 });
const add = (t: Tally, r: ResultRow) => {
  t.games++;
  if (r.won) t.wins++;
  t.points += r.points;
};

/** Wertet alle Ergebnisse eines Spielers aus (results enthält die Zeilen aller Spieler). */
export function playerDetail(results: ResultRow[], userId: string): PlayerDetail {
  const mine = results.filter((r) => r.user_id === userId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const byGame = new Map<string, ResultRow[]>();
  for (const r of results) {
    const list = byGame.get(r.game_id) ?? [];
    list.push(r);
    byGame.set(r.game_id, list);
  }

  const total = empty();
  const re = empty();
  const kontra = empty();
  const kinds = new Map<string, PlayerDetail['kinds'][number]>();
  const partners = new Map<string, Tally>();
  const timeline: PlayerDetail['timeline'] = [];
  let best: ResultRow | null = null;
  let worst: ResultRow | null = null;
  let streak = 0;
  let run = 0;

  for (const r of mine) {
    add(total, r);
    add(r.party === 're' ? re : kontra, r);
    // Soli: Solist und Gegenspieler getrennt, sonst vermischen sich ganz verschiedene Rollen
    const key = r.kind === 'solo' ? `solo:${r.solo}:${r.is_soloist ? 'self' : 'against'}` : r.kind;
    const k = kinds.get(key) ?? { key, kind: r.kind, solo: r.solo, soloist: r.is_soloist, tally: empty() };
    add(k.tally, r);
    kinds.set(key, k);
    for (const o of byGame.get(r.game_id) ?? []) {
      if (o.user_id === userId || o.party !== r.party) continue;
      const t = partners.get(o.user_id) ?? empty();
      add(t, r);
      partners.set(o.user_id, t);
    }
    timeline.push({ at: r.created_at, points: r.points, total: total.points });
    if (!best || r.points > best.points) best = r;
    if (!worst || r.points < worst.points) worst = r;
    run = r.won ? run + 1 : 0;
    streak = Math.max(streak, run);
  }

  return {
    total,
    re,
    kontra,
    kinds: [...kinds.values()].sort((a, b) => b.tally.games - a.tally.games),
    timeline,
    partners: [...partners.entries()].map(([id, tally]) => ({ userId: id, tally })).sort((a, b) => b.tally.games - a.tally.games),
    best,
    worst,
    streak,
  };
}
