import { describe, expect, it } from 'vitest';
import { explainTrick, explainTurn } from '../src/lib/explain';

const ctx = { mode: 'normal' as const, schweinchen: false };
const nameAt = (i: number) => ['Anna', 'Ben', 'Cem', 'Du'][i];

describe('explainTurn', () => {
  it('Fehlfarbe bedienen, Herz-Zehn zählt nicht als Herz', () => {
    const e = explainTurn(['H-A-0', 'H-10-0', 'C-Q-0'], ['H-K-0'], ctx, nameAt);
    expect(e.title).toBe('Du musst Herz bedienen');
    expect(e.lines.join(' ')).toContain('Herz-Zehn sieht nach Herz aus, ist aber Trumpf');
    expect(e.lines.join(' ')).toContain('Übernehmen kannst du mit: Herz-As');
  });
  it('frei, wenn man nicht bedienen kann', () => {
    const e = explainTurn(['S-A-0', 'D-9-0'], ['H-K-0', 'H-A-0'], ctx, nameAt);
    expect(e.title).toContain('kein Herz');
    expect(e.lines.join(' ')).toContain('Vorne liegt gerade Ben mit Herz-As');
    expect(e.lines.join(' ')).toContain('Übernehmen kannst du mit: Karo-Neun');
  });
  it('Stichgewinn per Trumpf', () => {
    expect(explainTrick(['H-K-0', 'D-9-0', 'H-A-0', 'H-9-0'], 1, ctx, nameAt)).toContain('Karo-Neun ist Trumpf');
  });
});
