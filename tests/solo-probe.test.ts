import { applyAction, createGame, type GameState } from '@engine';
import { it } from 'vitest';
import { botAction } from '../src/lib/bots';
import { seeded, settings } from './helpers';

it.skipIf(!process.env.TURNIER)('Vorbehalte auswerten', () => {
  const stats = new Map<string, { n: number; pts: number; wins: number }>();
  for (let seed = 1; seed <= 2500; seed++) {
    const rng = seeded(seed);
    let s: GameState = createGame({ players: ['a', 'b', 'c', 'd'], starter: 0, settings: settings(), rng });
    for (let g = 0; g < 600 && s.phase !== 'finished'; g++) {
      for (let p = 0; p < 4; p++) {
        const a = botAction(s, p, 'medium', { rng, noAnnounce: true });
        if (a) { s = applyAction(s, p, a, Date.now()); break; }
      }
    }
    const key = s.redeal ? `redeal:${s.redeal.reason}` : s.kind === 'solo' ? `solo:${s.solo}` : s.kind!;
    if (key === 'normal') continue;
    const st = stats.get(key) ?? { n: 0, pts: 0, wins: 0 };
    st.n++;
    if (s.result) {
      const p = s.kind === 'armut' ? s.armut!.poor : s.kind === 'solo' ? s.soloist! : s.reTeam[0];
      st.pts += s.result.scores[p];
      if (s.result.winner === 're') st.wins++;
    }
    stats.set(key, st);
  }
  for (const [k, v] of stats) console.log(k, v.n, 'Ø', (v.pts / v.n).toFixed(2), 'Re-Siege', v.wins);
}, 600_000);
