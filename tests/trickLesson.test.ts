import { DEFAULT_SETTINGS } from '@engine';
import { describe, expect, it } from 'vitest';
import { analyzeTrick, lessonText } from '../src/lib/trickLesson';

const ctx = { mode: 'normal' as const, schweinchen: false, dulleRule: 'first' as const };
const opts = { isLast: false, settings: DEFAULT_SETTINGS };
const name = (p: number) => ['Anna', 'Ben', 'Cem', 'Dora'][p];

describe('analyzeTrick', () => {
  it('Trumpf sticht Fehl', () => {
    const l = analyzeTrick(['H-A-0', 'H-K-0', 'D-J-0', 'S-9-0'], 0, ctx, opts);
    expect(l.winnerIdx).toBe(2);
    expect(l.reason).toBe('trumpBeats');
    expect(l.plays.map((p) => p.kind)).toEqual(['lead', 'follow', 'trump', 'discard']);
    expect(l.rules).toEqual(expect.arrayContaining(['follow', 'free', 'trumpBeats', 'augen']));
    expect(lessonText(l, ['H-A-0', 'H-K-0', 'D-J-0', 'S-9-0'], ctx, name).at(-1)).toContain('Cem gewinnt');
  });
  it('gleiche Karten: die erste gewinnt', () => {
    const l = analyzeTrick(['C-A-0', 'C-A-1', 'C-K-0', 'C-9-0'], 1, ctx, opts);
    expect(l.winnerIdx).toBe(0);
    expect(l.reason).toBe('equal');
  });
  it('Fuchs gefangen und Doppelkopf', () => {
    const party = (p: number) => (p === 0 || p === 1 ? 're' : 'kontra') as 're' | 'kontra';
    const l = analyzeTrick(['D-A-0', 'H-10-0', 'D-10-0', 'D-A-1'], 2, ctx, { ...opts, partyOf: party });
    // Dora (Kontra) gewinnt mit der Herz-Zehn und fängt das Karo-Ass von Ben (Re)
    expect(l.plays[l.winnerIdx].pos).toBe(3);
    expect(l.specials).toContain('fuchs');
    expect(l.specials).toContain('doppelkopf');
  });
});
