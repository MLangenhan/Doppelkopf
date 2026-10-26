import { applyAction, createGame, type GameState } from '@engine';
import { type BotLevel, type BotOptions, botAction } from '../src/lib/bots';
import { seeded, settings } from './helpers';

/** Spielt ein komplettes Spiel nur mit Bots und gibt die Punkte je Platz zurück. */
export function botGame(levels: BotLevel[], seed: number, samples = 4, extra: Omit<BotOptions, 'rng' | 'samples'> = {}): number[] {
  const rng = seeded(seed);
  let s: GameState = createGame({ players: ['a', 'b', 'c', 'd'], starter: seed % 4, settings: settings(), rng });
  for (let guard = 0; guard < 500 && s.phase !== 'finished'; guard++) {
    let acted = false;
    for (let p = 0; p < 4 && !acted; p++) {
      const action = botAction(s, p, levels[p], { rng, samples, ...extra });
      if (action) {
        s = applyAction(s, p, action, Date.now());
        acted = true;
      }
    }
    if (!acted) throw new Error(`Niemand kann handeln (Phase ${s.phase})`);
  }
  if (s.phase !== 'finished') throw new Error('Spiel wurde nicht fertig');
  return s.result ? s.result.scores : [0, 0, 0, 0];
}
