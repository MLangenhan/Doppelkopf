// Experimente zur Bot-Stärke, laufen nur auf Wunsch: TURNIER=1 npx vitest run tests/bot-tournament.test.ts
// Stellschrauben: N (Deals), SAMPLES, DUELS=hard:medium,…, NO_ANN=1, NO_RES=1
import { applyAction, createGame, type GameState } from '@engine';
import { it } from 'vitest';
import { type BotLevel, botAction } from '../src/lib/bots';
import { botGame } from './botGame';
import { seeded, settings } from './helpers';

const N = Number(process.env.N ?? 60);
const SAMPLES = Number(process.env.SAMPLES ?? 6);

function duel(a: BotLevel, b: BotLevel) {
  let sa = 0;
  let sb = 0;
  for (let seed = 100; seed < 100 + N; seed++) {
    for (const levels of [[a, b, a, b], [b, a, b, a]] as BotLevel[][]) {
      const scores = botGame(levels, seed, SAMPLES, { noAnnounce: !!process.env.NO_ANN, noReservations: !!process.env.NO_RES });
      scores.forEach((v, p) => (levels[p] === a ? (sa += v) : (sb += v)));
    }
  }
  const per = (x: number) => (x / (N * 4)).toFixed(3);
  console.log(`${a} vs ${b}: ${per(sa)} / ${per(sb)} Punkte pro Spieler und Spiel (${N * 2} Spiele)`);
}

it.skipIf(!process.env.TURNIER)('Turnier', () => {
  const duels = (process.env.DUELS ?? 'medium:easy,hard:medium,hard:easy').split(',');
  for (const d of duels) {
    const [a, b] = d.split(':') as BotLevel[];
    duel(a, b);
  }
}, 600_000);

/** Wie oft und wie erfolgreich spielt „Mittel“ Vorbehalte (Soli, Armut, Hochzeit)? */
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
