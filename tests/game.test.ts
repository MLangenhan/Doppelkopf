import { describe, expect, it } from 'vitest';
import {
  allowedDeclarations,
  announceError,
  applyAction,
  type Declaration,
  type GameState,
  legalCards,
  publicView,
  trickContext,
} from '@engine';
import { dealWith, newGame } from './helpers';

const healthy: Declaration = { kind: 'healthy' };

function declareAll(s: GameState, decls: Partial<Record<number, Declaration>> = {}): GameState {
  for (let i = 0; i < 4; i++) {
    const pos = (s.starter + i) % 4;
    s = applyAction(s, pos, { type: 'declare', declaration: decls[pos] ?? healthy });
  }
  return s;
}

function playFirstLegal(s: GameState): GameState {
  const pos = s.turn!;
  const card = legalCards(s.hands[pos], s.current!.cards, trickContext(s))[0];
  return applyAction(s, pos, { type: 'play', card });
}

function playTricks(s: GameState, n: number): GameState {
  for (let i = 0; i < n * 4; i++) s = playFirstLegal(s);
  return s;
}

describe('Vorbehalte', () => {
  it('Normalspiel: Re sind die Kreuz-Damen', () => {
    let s = newGame(dealWith([['C-Q'], [], ['C-Q'], []]));
    s = declareAll(s);
    expect(s.kind).toBe('normal');
    expect(s.reTeam).toEqual([0, 2]);
    expect(s.phase).toBe('playing');
    expect(s.turn).toBe(0);
  });

  it('Reihenfolge wird eingehalten', () => {
    const s = newGame(dealWith([[], [], [], []]), {}, 2);
    expect(() => applyAction(s, 0, { type: 'declare', declaration: healthy })).toThrow('nicht dran');
    expect(applyAction(s, 2, { type: 'declare', declaration: healthy }).declTurn).toBe(3);
  });

  it('Stilles Solo: beide Kreuz-Damen, gesund gemeldet', () => {
    let s = newGame(dealWith([[], ['C-Q', 'C-Q'], [], []]));
    s = declareAll(s);
    expect(s.kind).toBe('silentSolo');
    expect(s.reTeam).toEqual([1]);
    const view = publicView(s);
    expect(view.kind).toBe('normal');
    expect(view.soloist).toBeNull();
  });

  it('Hochzeit nur mit beiden Kreuz-Damen', () => {
    const hands = dealWith([['C-Q'], ['C-Q'], [], []]);
    expect(allowedDeclarations(hands[0], newGame(hands).settings).map((d) => d.kind)).not.toContain('hochzeit');
    const s = newGame(hands);
    expect(() => applyAction(s, 0, { type: 'declare', declaration: { kind: 'hochzeit' } })).toThrow();
  });

  it('Solo geht vor Hochzeit, Solist spielt aus', () => {
    let s = newGame(dealWith([['C-Q', 'C-Q'], [], [], []]));
    s = declareAll(s, { 0: { kind: 'hochzeit' }, 2: { kind: 'solo', solo: 'queens' } });
    expect(s.kind).toBe('solo');
    expect(s.solo).toBe('queens');
    expect(s.soloist).toBe(2);
    expect(s.reTeam).toEqual([2]);
    expect(s.turn).toBe(2);
  });

  it('Bei zwei Soli gewinnt das erste in Spielreihenfolge', () => {
    let s = newGame(dealWith([[], [], [], []]), {}, 2);
    s = declareAll(s, { 0: { kind: 'solo', solo: 'jacks' }, 3: { kind: 'solo', solo: 'hearts' } });
    expect(s.soloist).toBe(3);
  });

  it('Abgewählte Soli sind nicht erlaubt', () => {
    const s = newGame(dealWith([[], [], [], []]), {
      soli: { queens: false, jacks: true, fleischlos: true, clubs: true, spades: true, hearts: true, diamonds: true },
    });
    expect(() => applyAction(s, 0, { type: 'declare', declaration: { kind: 'solo', solo: 'queens' } })).toThrow();
  });

  it('Schmeißen bei fünf Königen führt zum Neugeben', () => {
    let s = newGame(dealWith([['C-K', 'C-K', 'S-K', 'S-K', 'H-K'], [], [], []]));
    s = declareAll(s, { 0: { kind: 'schmeissen', reason: 'fiveKings' } });
    expect(s.phase).toBe('finished');
    expect(s.redeal).toEqual({ reason: 'schmeissen', pos: 0, detail: 'fiveKings' });
    expect(s.result).toBeNull();
  });

  it('Schmeißen bei weniger als 3 Trumpf und über 80 Augen', () => {
    const hand = dealWith([['C-A', 'C-A', 'S-A', 'S-A', 'H-A', 'H-A', 'C-10', 'C-10', 'S-10', 'D-K'], [], [], []])[0];
    const reasons = allowedDeclarations(hand, newGame([hand, [], [], []]).settings)
      .filter((d) => d.kind === 'schmeissen')
      .map((d) => (d as { reason: string }).reason);
    expect(reasons).toEqual(['over80', 'fewTrumps']);
  });

  it('Schmeißen-Gründe lassen sich abschalten', () => {
    const hand = dealWith([['C-K', 'C-K', 'S-K', 'S-K', 'H-K'], [], [], []])[0];
    const s = newGame([hand, [], [], []], {
      schmeissen: { over80: false, fiveKings: false, fewTrumps: false, fiveNines: false },
    });
    expect(allowedDeclarations(hand, s.settings).some((d) => d.kind === 'schmeissen')).toBe(false);
  });
});

describe('Armut', () => {
  const poorHand = ['D-J', 'D-K', 'D-10', 'C-A', 'C-A', 'C-10', 'C-10', 'S-A', 'S-A', 'S-10'];

  it('nur bei genau drei Trümpfen', () => {
    const hands = dealWith([poorHand, [], [], []]);
    expect(allowedDeclarations(hands[0], newGame(hands).settings).some((d) => d.kind === 'armut')).toBe(true);
  });

  it('Trümpfe wandern zum Reichen, drei Karten zurück', () => {
    let s = newGame(dealWith([poorHand, [], [], []]));
    s = declareAll(s, { 0: { kind: 'armut' } });
    expect(s.phase).toBe('armutOffer');
    expect(s.armut!.offerTurn).toBe(1);
    expect(() => applyAction(s, 2, { type: 'armutAnswer', accept: true })).toThrow('nicht dran');
    s = applyAction(s, 1, { type: 'armutAnswer', accept: false });
    s = applyAction(s, 2, { type: 'armutAnswer', accept: true });
    expect(s.phase).toBe('armutReturn');
    expect(s.hands[0]).toHaveLength(7);
    expect(s.hands[2]).toHaveLength(13);

    const back = [s.hands[2][0], s.hands[2][1], s.hands[2][2]];
    expect(() => applyAction(s, 2, { type: 'armutReturn', cards: back.slice(0, 2) })).toThrow();
    s = applyAction(s, 2, { type: 'armutReturn', cards: back });
    expect(s.hands.map((h) => h.length)).toEqual([10, 10, 10, 10]);
    expect(s.kind).toBe('armut');
    expect(s.reTeam).toEqual([0, 2]);
    expect(s.armut!.returnedTrumps).not.toBeNull();
    expect(s.turn).toBe(0);
  });

  it('Niemand nimmt mit: neu geben', () => {
    let s = newGame(dealWith([poorHand, [], [], []]));
    s = declareAll(s, { 0: { kind: 'armut' } });
    for (const p of [1, 2, 3]) s = applyAction(s, p, { type: 'armutAnswer', accept: false });
    expect(s.phase).toBe('finished');
    expect(s.redeal?.reason).toBe('armut');
  });
});

describe('Hochzeit', () => {
  it('Wer den ersten fremden Stich macht, wird Partner', () => {
    let s = newGame(dealWith([['C-Q', 'C-Q', 'C-A'], ['H-10', 'H-10'], [], []]));
    s = declareAll(s, { 0: { kind: 'hochzeit' } });
    expect(announceError(s, 0, 120)).toMatch(/Klärung/);
    s = applyAction(s, 0, { type: 'play', card: s.hands[0].find((c) => c.startsWith('C-Q'))! });
    s = applyAction(s, 1, { type: 'play', card: s.hands[1].find((c) => c.startsWith('H-10'))! });
    s = playFirstLegal(playFirstLegal(s));
    expect(s.tricks[0].winner).toBe(1);
    expect(s.hochzeit!.partner).toBe(1);
    expect(s.reTeam).toEqual([0, 1]);
    // Fristen verschieben sich um einen Stich: Re geht noch, obwohl schon eine Karte gespielt ist.
    expect(announceError(s, 0, 120)).toBeNull();
  });

  it('Gewinnt die Braut die ersten drei Stiche, spielt sie allein (Solo-Wertung)', () => {
    const top = ['H-10', 'H-10', 'C-Q', 'C-Q', 'S-Q', 'S-Q', 'H-Q', 'H-Q', 'D-Q', 'D-Q'];
    let s = newGame(dealWith([top, [], [], []]));
    s = declareAll(s, { 0: { kind: 'hochzeit' } });
    s = playTricks(s, 3);
    expect(s.hochzeit!.alone).toBe(true);
    expect(s.reTeam).toEqual([0]);
    s = playTricks(s, 7);
    expect(s.phase).toBe('finished');
    expect(s.result!.soloScoring).toBe(true);
    expect(s.result!.scores.reduce((a, b) => a + b, 0)).toBe(0);
    expect(s.result!.scores[0]).toBe(3 * s.result!.reValue);
  });
});

describe('Spielen', () => {
  it('Nur wer dran ist, nur eigene Karten, Bedienpflicht', () => {
    let s = declareAll(newGame(dealWith([['C-A'], ['C-K', 'D-K'], [], []])));
    expect(() => applyAction(s, 1, { type: 'play', card: s.hands[1][0] })).toThrow('nicht dran');
    expect(() => applyAction(s, 0, { type: 'play', card: s.hands[1][0] })).toThrow('nicht');
    s = applyAction(s, 0, { type: 'play', card: s.hands[0].find((c) => c.startsWith('C-A'))! });
    const trump = s.hands[1].find((c) => c.startsWith('D-K'))!;
    expect(() => applyAction(s, 1, { type: 'play', card: trump })).toThrow('bedienen');
  });

  it('Ein komplettes Spiel endet mit 240 Augen und Nullsumme', () => {
    let s = declareAll(newGame(dealWith([['C-Q'], ['C-Q'], [], []])));
    s = playTricks(s, 10);
    expect(s.phase).toBe('finished');
    const r = s.result!;
    expect(r.augen.re + r.augen.kontra).toBe(240);
    expect(r.scores.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe('Ansagen', () => {
  it('Re bis vor der zweiten Karte, Kontra für die anderen', () => {
    let s = declareAll(newGame(dealWith([['C-Q'], ['C-Q'], [], []])));
    expect(announceError(s, 0, 120)).toBeNull();
    s = playFirstLegal(s); // Spieler 0 hat eine Karte gespielt
    expect(announceError(s, 0, 120)).toBeNull();
    s = applyAction(s, 2, { type: 'announce', level: 120 });
    expect(s.announcements).toEqual({ re: null, kontra: 120 });
    expect(() => applyAction(s, 3, { type: 'announce', level: 120 })).toThrow('schon');
    while (s.hands[0].length > 8) s = playFirstLegal(s);
    // Spieler 0 hat jetzt zwei Karten gespielt
    expect(announceError(s, 0, 120)).toMatch(/spät/);
  });

  it('Absage überspringt Stufen und hat eigene Frist', () => {
    let s = declareAll(newGame(dealWith([['C-Q'], ['C-Q'], [], []])));
    s = applyAction(s, 1, { type: 'announce', level: 60 });
    expect(s.announcements.re).toBe(60);
    expect(publicView(s).knownParties[1]).toBe('re');
    expect(announceError(s, 0, 90)).toMatch(/schon/);
    expect(announceError(s, 0, 30)).toBeNull();
  });

  it('Lassen sich abschalten', () => {
    const s = declareAll(newGame(dealWith([['C-Q'], ['C-Q'], [], []]), { announcements: false }));
    expect(announceError(s, 0, 120)).toMatch(/ausgeschaltet/);
  });
});

describe('Öffentliche Sicht', () => {
  it('enthält keine Hände und deckt Parteien durch gespielte Kreuz-Damen auf', () => {
    let s = declareAll(newGame(dealWith([['C-Q'], [], ['C-Q'], []])));
    const v = publicView(s);
    expect(JSON.stringify(v)).not.toContain('"hands"');
    expect(v.dealtHands).toBeNull();
    expect(v.knownParties).toEqual([null, null, null, null]);
    s = applyAction(s, 0, { type: 'play', card: s.hands[0].find((c) => c.startsWith('C-Q'))! });
    expect(publicView(s).knownParties[0]).toBe('re');
  });

  it('Schweinchen wird erst beim Ausspielen sichtbar', () => {
    let s = declareAll(newGame(dealWith([['D-A', 'D-A', 'C-Q'], ['C-Q'], [], []])));
    expect(s.schweinchen).toBe(0);
    expect(publicView(s).schweinchen).toBeNull();
    s = applyAction(s, 0, { type: 'play', card: s.hands[0].find((c) => c.startsWith('D-A'))! });
    expect(publicView(s).schweinchen).toBe(0);
  });
});
