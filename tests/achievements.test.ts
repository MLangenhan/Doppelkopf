import { applyAction, botAction, createGame, type GameState, publicView } from '@engine';
import { describe, expect, it } from 'vitest';
import { badgesOfGame, eveningTitles } from '../src/lib/achievements';
import type { GameRow, ResultRow } from '../src/lib/supabase';
import { seeded, settings } from './helpers';

function finishedGame(seed: number): GameState {
  const rng = seeded(seed);
  let s = createGame({ players: ['a', 'b', 'c', 'd'], starter: seed % 4, settings: settings(), rng });
  for (let g = 0; g < 600 && s.phase !== 'finished'; g++) {
    for (let p = 0; p < 4; p++) {
      const a = botAction(s, p, 'medium', { rng });
      if (a) {
        s = applyAction(s, p, a, Date.now());
        break;
      }
    }
  }
  return s;
}

describe('Abzeichen', () => {
  it('passen zur Abrechnung (Fuchs, Doppelkopf, Karlchen)', () => {
    let checked = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const s = finishedGame(seed);
      if (!s.result || s.result.soloScoring) continue;
      const view = publicView(s);
      const badges = badgesOfGame(view);
      const lines = (label: string) => s.result!.lines.filter((l) => l.label === label).length;
      expect(badges.filter((b) => b.key === 'fuchs').length).toBe(lines('Fuchs gefangen'));
      expect(badges.filter((b) => b.key === 'doppelkopf').length).toBe(lines('Doppelkopf'));
      expect(badges.filter((b) => b.key === 'karlchen').length).toBe(lines('Karlchen'));
      checked++;
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('Titel des Abends: König und Pechvogel aus den Punkten', () => {
    const row = (user_id: string, points: number): ResultRow => ({
      game_id: 'g', user_id, table_id: 't', points, party: 're', won: points > 0, kind: 'normal', solo: null, is_soloist: false, created_at: '',
    });
    const titles = eveningTitles([row('a', 5), row('b', -3), row('c', 1), row('d', -3)], [] as GameRow[]);
    expect(titles.find((t) => t.title === 'König des Abends')?.holders).toEqual(['a']);
    expect(titles.find((t) => t.title === 'Pechvogel')?.holders).toEqual(['b', 'd']);
  });
});
