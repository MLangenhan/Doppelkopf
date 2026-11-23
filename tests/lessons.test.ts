import { actorOf, applyAction, createGame, DEFAULT_SETTINGS, type GameState } from '@engine';
import { describe, expect, it } from 'vitest';
import { CONCEPTS, LESSONS } from '../src/lib/lessons';

/** Spielt ein Drehbuch so durch, wie es die Lektion tut – jeder Zug muss regelkonform sein. */
function runLesson(i: number) {
  const l = LESSONS[i];
  let s: GameState = createGame({ players: ['me', 'b1', 'b2', 'b3'], starter: l.starter, settings: DEFAULT_SETTINGS, hands: l.hands });
  while (s.phase === 'reservations') {
    const p = actorOf(s)!;
    s = applyAction(s, p, { type: 'declare', declaration: { kind: 'healthy' } });
  }
  const winners: number[] = [];
  for (const b of l.beats) {
    if (b.t === 'play') {
      expect(actorOf(s), `Lektion ${l.stage}: ${b.card} von ${b.pos}`).toBe(b.pos);
      s = applyAction(s, b.pos, { type: 'play', card: b.card });
    } else if (b.t === 'announce') {
      s = applyAction(s, b.pos, { type: 'announce', level: b.level });
    } else if (b.t === 'collect') {
      expect(s.collectPending).toBe(true);
      const w = s.tricks.at(-1)!.winner!;
      winners.push(w);
      s = applyAction(s, w, { type: 'collect' });
    } else if (b.t === 'card') {
      const c = CONCEPTS[b.concept];
      expect(c.points.length).toBeLessThanOrEqual(2);
    }
  }
  return { s, winners };
}

describe('Lektionen', () => {
  it('haben vollständige, faire Blätter', () => {
    for (const l of LESSONS) {
      expect(l.hands.map((h) => h.length)).toEqual([10, 10, 10, 10]);
      expect(new Set(l.hands.flat()).size).toBe(40);
      // genau eine Kreuz-Dame bei zwei verschiedenen Spielern (keine Hochzeit)
      expect(l.hands.filter((h) => h.some((c) => c.startsWith('C-Q'))).length).toBe(2);
    }
  });
  it('Lektion 1 läuft regelkonform', () => expect(runLesson(0).winners).toEqual([0, 2, 0, 0]));
  it('Lektion 2 läuft regelkonform', () => expect(runLesson(1).winners).toEqual([2, 0, 0, 0]));
  it('Lektion 3 läuft regelkonform', () => {
    const { s, winners } = runLesson(2);
    expect(winners).toEqual([0, 0]);
    expect(s.announcements).toEqual({ re: 120, kontra: 120 });
  });
  it('Lektion 4 läuft regelkonform', () => expect(runLesson(3).winners).toEqual([0, 0]));
});
