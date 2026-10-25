import { describe, expect, it } from 'vitest';
import {
  ANNOUNCE_LEVELS,
  allowedDeclarations,
  announceError,
  applyAction,
  createGame,
  type GameState,
  legalCards,
  publicView,
  type RuleSettings,
  trickContext,
} from '@engine';
import { seeded, settings } from './helpers';

function randomSettings(rng: () => number): RuleSettings {
  const b = () => rng() < 0.5;
  return settings({
    withNines: b(),
    dulleRule: (['first', 'second', 'secondInLastTrick'] as const)[Math.floor(rng() * 3)],
    doppelkopf: b(),
    fuchs: b(),
    karlchen: b(),
    schweinchen: b(),
    armut: b(),
    announcements: b(),
  });
}

/** Spielt ein komplettes Spiel mit zufälligen, aber legalen Entscheidungen. */
function randomGame(seed: number): GameState {
  const rng = seeded(seed);
  const pick = <T,>(items: T[]) => items[Math.floor(rng() * items.length)];
  let s = createGame({ players: ['a', 'b', 'c', 'd'], starter: seed % 4, settings: randomSettings(rng), rng });

  for (let guard = 0; guard < 800 && s.phase !== 'finished'; guard++) {
    if (s.phase === 'reservations') {
      const pos = s.declTurn!;
      const options = allowedDeclarations(s.hands[pos], s.settings);
      const declaration = rng() < 0.7 ? options[0] : pick(options);
      s = applyAction(s, pos, { type: 'declare', declaration });
    } else if (s.phase === 'armutOffer') {
      s = applyAction(s, s.armut!.offerTurn!, { type: 'armutAnswer', accept: rng() < 0.5 });
    } else if (s.phase === 'armutReturn') {
      const rich = s.armut!.rich!;
      const hand = [...s.hands[rich]].sort(() => rng() - 0.5);
      s = applyAction(s, rich, { type: 'armutReturn', cards: hand.slice(0, 3) });
    } else {
      if (rng() < 0.15) {
        const pos = Math.floor(rng() * 4);
        const level = pick(ANNOUNCE_LEVELS);
        if (announceError(s, pos, level) === null) s = applyAction(s, pos, { type: 'announce', level });
      }
      if (s.collectPending) {
        s = applyAction(s, s.turn!, { type: 'collect' });
        continue;
      }
      const pos = s.turn!;
      const card = pick(legalCards(s.hands[pos], s.current!.cards, trickContext(s)));
      s = applyAction(s, pos, { type: 'play', card });
    }
  }
  return s;
}

describe('Zufallsspiele', () => {
  it('1500 Spiele laufen fehlerfrei durch und sind konsistent', () => {
    const kinds = new Map<string, number>();
    for (let seed = 1; seed <= 1500; seed++) {
      const s = randomGame(seed);
      expect(s.phase).toBe('finished');
      const key = s.redeal ? `redeal:${s.redeal.reason}` : s.kind!;
      kinds.set(key, (kinds.get(key) ?? 0) + 1);
      if (s.redeal) continue;

      const r = s.result!;
      const size = s.settings.withNines ? 12 : 10;
      expect(s.tricks).toHaveLength(size);
      expect(r.augen.re + r.augen.kontra).toBe(240);
      expect(r.tricks.re + r.tricks.kontra).toBe(size);
      expect(r.scores.reduce((a, b) => a + b, 0)).toBe(0);
      expect(s.hands.every((h) => h.length === 0)).toBe(true);
      // Jede Karte genau einmal gespielt
      expect(new Set(s.tricks.flatMap((t) => t.cards)).size).toBe(size * 4);
      expect(r.reTeam.length + r.kontraTeam.length).toBe(4);
      if (r.soloScoring) expect(r.reTeam).toHaveLength(1);
      else expect(r.reTeam).toHaveLength(2);
      // Öffentliche Sicht lässt sich serialisieren
      expect(() => JSON.stringify(publicView(s))).not.toThrow();
    }
    // Alle Spielarten kommen vor
    for (const k of ['normal', 'solo', 'hochzeit', 'armut', 'redeal:schmeissen']) {
      expect(kinds.get(k) ?? 0).toBeGreaterThan(0);
    }
  }, 60_000);
});
