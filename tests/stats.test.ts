import { describe, expect, it } from 'vitest';
import { playerDetail } from '../src/lib/stats';
import type { ResultRow } from '../src/lib/supabase';

const row = (game: string, user: string, party: 're' | 'kontra', points: number, at: string, extra: Partial<ResultRow> = {}): ResultRow => ({
  game_id: game,
  user_id: user,
  table_id: 't',
  points,
  party,
  won: points > 0,
  kind: 'normal',
  solo: null,
  is_soloist: false,
  created_at: at,
  ...extra,
});

describe('playerDetail', () => {
  const results = [
    row('g1', 'a', 're', 2, '1'), row('g1', 'b', 're', 2, '1'), row('g1', 'c', 'kontra', -2, '1'), row('g1', 'd', 'kontra', -2, '1'),
    row('g2', 'a', 'kontra', 1, '2'), row('g2', 'c', 'kontra', 1, '2'), row('g2', 'b', 're', -1, '2'), row('g2', 'd', 're', -1, '2'),
    row('g3', 'a', 're', -9, '3', { kind: 'solo', solo: 'queens', is_soloist: true }),
    row('g3', 'b', 'kontra', 3, '3', { kind: 'solo', solo: 'queens' }),
  ];
  const d = playerDetail(results, 'a');

  it('zählt Parteien, Verlauf und Serien', () => {
    expect(d.total).toEqual({ games: 3, wins: 2, points: -6 });
    expect(d.re).toEqual({ games: 2, wins: 1, points: -7 });
    expect(d.kontra).toEqual({ games: 1, wins: 1, points: 1 });
    expect(d.timeline.map((t) => t.total)).toEqual([2, 3, -6]);
    expect(d.streak).toBe(2);
    expect(d.best?.game_id).toBe('g1');
    expect(d.worst?.game_id).toBe('g3');
  });

  it('trennt Soli und findet Partner', () => {
    expect(d.kinds.find((k) => k.key === 'solo:queens:self')?.tally.games).toBe(1);
    expect(d.partners.find((p) => p.userId === 'b')?.tally).toEqual({ games: 1, wins: 1, points: 2 });
    expect(d.partners.find((p) => p.userId === 'c')?.tally).toEqual({ games: 1, wins: 1, points: 1 });
  });
});
