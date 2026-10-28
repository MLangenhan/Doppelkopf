import { describe, expect, it } from 'vitest';
import { type AnnounceLevel, augenTargets, type Card, type GameState, scoreGame } from '@engine';
import { newGame, settings } from './helpers';

/**
 * Baut ein beendetes Spiel aus Stichen. Jeder Stich: [Gewinner, Karten (Ausspieler = Gewinner)].
 * Die Karten-Kopien werden nicht geprüft – es geht nur um Augen und Sonderpunkte.
 */
function finished(opts: {
  reTeam: number[];
  tricks: [number, Card[], number?][];
  kind?: GameState['kind'];
  ann?: Partial<Record<'re' | 'kontra', AnnounceLevel>>;
  schweinchen?: number | null;
}): GameState {
  const s = newGame([[], [], [], []]);
  s.settings = settings();
  s.phase = 'finished';
  s.kind = opts.kind ?? 'normal';
  s.reTeam = opts.reTeam;
  s.announcements = { re: opts.ann?.re ?? null, kontra: opts.ann?.kontra ?? null };
  s.schweinchen = opts.schweinchen ?? null;
  s.tricks = opts.tricks.map(([winner, cards, leader]) => ({ leader: leader ?? winner, cards, winner }));
  return s;
}

const c = (f: string) => `${f}-0`;
// 4 Karten mit genau so vielen Augen wie gewünscht (aus A=11, 10, K=4, Q=3, J=2, 9=0)
const zeroTrick = [c('C-9'), c('S-9'), c('H-9'), c('D-9')];

const VALUES = [
  ['C-A', 11],
  ['C-10', 10],
  ['C-K', 4],
  ['C-Q', 3],
  ['C-J', 2],
  ['S-9', 0],
] as const;

/** Vier Karten mit genau `augen` Augen. */
function cardsWorth(augen: number): Card[] {
  for (const a of VALUES) for (const b of VALUES) for (const d of VALUES) for (const e of VALUES) {
    if (a[1] + b[1] + d[1] + e[1] === augen) return [a, b, d, e].map(([f]) => c(f));
  }
  throw new Error(`kann ${augen} nicht darstellen`);
}

/** Verteilt `augen` auf ein paar Stiche ohne Sonderpunkte (kein Stich >= 40). */
function tricksWorth(winner: number, augen: number): [number, Card[]][] {
  const out: [number, Card[]][] = [];
  let left = augen;
  while (left > 0) {
    let chunk = Math.min(left, 30);
    if (left - chunk === 1) chunk -= 2;
    out.push([winner, cardsWorth(chunk)]);
    left -= chunk;
  }
  return out;
}

function game(reAugen: number, opts: Partial<Parameters<typeof finished>[0]> = {}) {
  return finished({
    reTeam: [0, 2],
    tricks: [...tricksWorth(0, reAugen), ...tricksWorth(1, 240 - reAugen), [1, zeroTrick]],
    ...opts,
  });
}

const labels = (s: GameState) => scoreGame(s).lines.map((l) => `${l.party}:${l.label}`);

describe('Gewinner', () => {
  it('Re gewinnt mit 121, verliert mit 120', () => {
    expect(scoreGame(game(121)).winner).toBe('re');
    expect(scoreGame(game(120)).winner).toBe('kontra');
  });

  it('Nur Kontra angesagt: Kontra braucht 121', () => {
    expect(scoreGame(game(120, { ann: { kontra: 120 } })).winner).toBe('re');
    expect(scoreGame(game(119, { ann: { kontra: 120 } })).winner).toBe('kontra');
  });

  it('Re sagt keine 90: braucht 151', () => {
    expect(scoreGame(game(150, { ann: { re: 90 } })).winner).toBe('kontra');
    expect(scoreGame(game(151, { ann: { re: 90 } })).winner).toBe('re');
  });

  it('Kontra sagt keine 90, Re schafft 90', () => {
    const r = scoreGame(game(90, { ann: { kontra: 90 } }));
    expect(r.winner).toBe('re');
  });

  it('Beide Absagen nicht erfüllt: kein Gewinner', () => {
    expect(scoreGame(game(140, { ann: { re: 90, kontra: 90 } })).winner).toBeNull();
  });
});

describe('Punkte', () => {
  it('Einfaches Normalspiel: 1 Punkt, Nullsumme', () => {
    const r = scoreGame(game(130));
    expect(r.lines).toEqual([{ label: 'Gewonnen', party: 're', points: 1 }]);
    expect(r.scores).toEqual([1, -1, 1, -1]);
  });

  it('Gegen die Alten', () => {
    expect(labels(game(100))).toEqual(['kontra:Gewonnen', 'kontra:Gegen die Alten']);
    expect(scoreGame(game(100)).scores).toEqual([-2, 2, -2, 2]);
  });

  it('Re angesagt zählt 2, keine 90 gespielt 1', () => {
    const r = scoreGame(game(160, { ann: { re: 120 } }));
    expect(r.reValue).toBe(1 + 2 + 1);
  });

  it('Absagen und Erfolge summieren sich', () => {
    // Re: keine 60 abgesagt, erreicht 190 (Kontra 50)
    const r = scoreGame(game(190, { ann: { re: 60 } }));
    expect(labels(game(190, { ann: { re: 60 } }))).toEqual([
      're:Gewonnen',
      're:Re angesagt',
      're:Keine 90 abgesagt (Re)',
      're:Keine 60 abgesagt (Re)',
      're:Keine 90 gespielt',
      're:Keine 60 gespielt',
    ]);
    expect(r.reValue).toBe(7);
  });

  it('120 gegen keine 90', () => {
    const r = scoreGame(game(125, { ann: { kontra: 90 } }));
    expect(r.winner).toBe('re');
    expect(r.lines.map((l) => l.label)).toContain('120 gegen keine 90');
  });

  it('Schwarz', () => {
    const s = finished({ reTeam: [0, 2], tricks: tricksWorth(0, 240) });
    expect(labels(s)).toContain('re:Schwarz gespielt');
  });

  it('Solo zählt dreifach für den Solisten', () => {
    const r = scoreGame(game(130, { kind: 'solo', reTeam: [0] }));
    expect(r.scores).toEqual([3, -1, -1, -1]);
    expect(r.lines.map((l) => l.label)).not.toContain('Gegen die Alten');
  });
});

describe('Sonderpunkte', () => {
  it('Doppelkopf: Stich mit mindestens 40 Augen', () => {
    const s = game(130);
    s.tricks.push({ leader: 1, winner: 1, cards: [c('C-A'), c('S-A'), c('H-A'), c('C-10')] });
    // Augen verschieben sich dadurch, ist hier egal
    expect(labels(s)).toContain('kontra:Doppelkopf');
  });

  it('Fuchs gefangen nur vom Gegner', () => {
    const s = game(130);
    // Spieler 0 (Re) spielt Karo-As, Spieler 1 (Kontra) gewinnt
    s.tricks.push({ leader: 0, winner: 1, cards: [c('D-A'), c('C-Q'), c('S-9'), c('H-9')] });
    expect(labels(s).filter((l) => l.endsWith('Fuchs gefangen'))).toEqual(['kontra:Fuchs gefangen']);
    // Partner fängt eigenen Fuchs: zählt nicht
    const t = game(130);
    t.tricks.push({ leader: 0, winner: 2, cards: [c('D-A'), c('S-9'), c('C-Q'), c('H-9')] });
    expect(labels(t).some((l) => l.endsWith('Fuchs gefangen'))).toBe(false);
  });

  it('Karlchen: letzter Stich mit Kreuz-Bube', () => {
    const s = game(130);
    s.tricks.push({ leader: 3, winner: 0, cards: [c('D-9'), c('C-J'), c('S-9'), c('H-9')] });
    expect(labels(s)).toContain('re:Karlchen');
  });

  it('Keine Sonderpunkte im Solo, und abschaltbar', () => {
    const s = game(130, { kind: 'solo', reTeam: [0] });
    s.tricks.push({ leader: 1, winner: 1, cards: [c('C-A'), c('S-A'), c('H-A'), c('C-10')] });
    expect(labels(s)).not.toContain('kontra:Doppelkopf');
    const t = game(130);
    t.settings = settings({ doppelkopf: false });
    t.tricks.push({ leader: 1, winner: 1, cards: [c('C-A'), c('S-A'), c('H-A'), c('C-10')] });
    expect(labels(t)).not.toContain('kontra:Doppelkopf');
  });

  it('Sonderpunkte werden gegeneinander verrechnet', () => {
    const s = game(170);
    s.tricks.push({ leader: 1, winner: 1, cards: [c('C-A'), c('S-A'), c('H-A'), c('C-10')] });
    const r = scoreGame(s);
    // Re gewinnt (1), Kontra hat einen Doppelkopf (1) → 0
    expect(r.winner).toBe('re');
    expect(r.reValue).toBe(0);
  });
});

describe('Siegmarken (augenTargets)', () => {
  it('ohne Ansage 121/120, mit Absagen verschoben', () => {
    expect(augenTargets({ re: null, kontra: null })).toEqual({ re: 121, kontra: 120 });
    expect(augenTargets({ re: null, kontra: 120 })).toEqual({ re: 120, kontra: 121 });
    expect(augenTargets({ re: 90, kontra: null })).toEqual({ re: 151, kontra: 90 });
    expect(augenTargets({ re: 120, kontra: 60 })).toEqual({ re: 60, kontra: 181 });
    expect(augenTargets({ re: 0, kontra: null })).toEqual({ re: null, kontra: null });
  });
});
