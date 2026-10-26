import { describe, expect, it } from 'vitest';
import { botGame } from './botGame';

describe('Bots', () => {
  it('spielen auf allen Stufen komplette Spiele regelkonform', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const scores = botGame(['easy', 'medium', 'hard', 'medium'], seed);
      expect(scores.reduce((a, b) => a + b, 0)).toBe(0);
    }
  });
});
