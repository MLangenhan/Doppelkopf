// Stärkevergleich der Bot-Stufen, läuft nur auf Wunsch: TURNIER=1 npx vitest run tests/bot-tournament.test.ts
import { it } from 'vitest';
import type { BotLevel } from '../src/lib/bots';
import { botGame } from './botGame';

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
