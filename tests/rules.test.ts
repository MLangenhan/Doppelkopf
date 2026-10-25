import { describe, expect, it } from 'vitest';
import {
  createDeck,
  deal,
  isTrump,
  legalCards,
  sortHand,
  sumAugen,
  trickWinnerIndex,
  trumpOrder,
  type TrickContext,
} from '@engine';
import { card } from './helpers';

const normal: TrickContext = { mode: 'normal', schweinchen: false, dulleRule: 'first' };

describe('Deck', () => {
  it('hat 48 Karten mit Neunen und 40 ohne, immer 240 Augen', () => {
    expect(createDeck(true)).toHaveLength(48);
    expect(createDeck(false)).toHaveLength(40);
    expect(sumAugen(createDeck(true))).toBe(240);
    expect(sumAugen(createDeck(false))).toBe(240);
  });

  it('teilt gleichmäßig an vier Spieler aus', () => {
    const hands = deal(false);
    expect(hands.map((h) => h.length)).toEqual([10, 10, 10, 10]);
    expect(new Set(hands.flat()).size).toBe(40);
    expect(deal(true).map((h) => h.length)).toEqual([12, 12, 12, 12]);
  });
});

describe('Trumpf-Reihenfolge', () => {
  it('Normalspiel: Dullen, Damen, Buben, Karo', () => {
    expect(trumpOrder('normal')).toEqual([
      'H-10', 'C-Q', 'S-Q', 'H-Q', 'D-Q', 'C-J', 'S-J', 'H-J', 'D-J', 'D-A', 'D-10', 'D-K', 'D-9',
    ]);
  });

  it('Schweinchen: Karo-Asse über den Dullen', () => {
    expect(trumpOrder('normal', true).slice(0, 2)).toEqual(['D-A', 'H-10']);
  });

  it('Herz-Solo: Herz-Zehn bleibt Dulle, restliche Herz sind Trumpf', () => {
    const order = trumpOrder('hearts');
    expect(order[0]).toBe('H-10');
    expect(order.slice(-3)).toEqual(['H-A', 'H-K', 'H-9']);
    expect(order.filter((f) => f === 'H-10')).toHaveLength(1);
  });

  it('Damensolo: nur Damen sind Trumpf', () => {
    const ctx = { mode: 'queens' as const, schweinchen: false };
    expect(isTrump(card('C-Q'), ctx)).toBe(true);
    expect(isTrump(card('C-J'), ctx)).toBe(false);
    expect(isTrump(card('H-10'), ctx)).toBe(false);
    expect(isTrump(card('D-A'), ctx)).toBe(false);
  });

  it('Fleischloser: kein Trumpf', () => {
    expect(trumpOrder('fleischlos')).toEqual([]);
  });
});

describe('Bedienpflicht', () => {
  const hand = [card('H-10'), card('H-A'), card('C-A'), card('D-K')];

  it('Herz-Zehn ist Trumpf und bedient kein Herz', () => {
    expect(legalCards(hand, [card('H-K')], normal)).toEqual([card('H-A')]);
  });

  it('Trumpf muss bedient werden', () => {
    expect(legalCards(hand, [card('C-J')], normal).sort()).toEqual([card('D-K'), card('H-10')].sort());
  });

  it('Wer nicht bedienen kann, darf alles spielen', () => {
    expect(legalCards(hand, [card('S-A')], normal)).toHaveLength(4);
  });

  it('Im Bubensolo bedient ein Damen eine Fehlfarbe', () => {
    const ctx = { mode: 'jacks' as const, schweinchen: false };
    const h = [card('C-Q'), card('C-J'), card('H-A')];
    expect(legalCards(h, [card('C-A')], ctx)).toEqual([card('C-Q')]);
  });
});

describe('Stichauswertung', () => {
  it('Trumpf schlägt Fehl, Abwerfen gewinnt nie', () => {
    expect(trickWinnerIndex([card('C-A'), card('C-10'), card('D-9'), card('S-A')], normal, false)).toBe(2);
    expect(trickWinnerIndex([card('C-K'), card('S-A'), card('H-A'), card('C-10')], normal, false)).toBe(3);
  });

  it('Bei gleichen Karten gewinnt die erste', () => {
    expect(trickWinnerIndex([card('C-Q', 0), card('C-Q', 1), card('D-J'), card('D-9')], normal, false)).toBe(0);
  });

  it('Dulle: erste gewinnt bei Regel "first"', () => {
    const t = [card('C-J'), card('H-10', 0), card('H-10', 1), card('D-A')];
    expect(trickWinnerIndex(t, normal, false)).toBe(1);
    expect(trickWinnerIndex(t, normal, true)).toBe(1);
  });

  it('Dulle: zweite gewinnt bei Regel "second"', () => {
    const t = [card('C-J'), card('H-10', 0), card('H-10', 1), card('D-A')];
    expect(trickWinnerIndex(t, { ...normal, dulleRule: 'second' }, false)).toBe(2);
  });

  it('Dulle: zweite gewinnt nur im letzten Stich bei Regel "secondInLastTrick"', () => {
    const t = [card('C-J'), card('H-10', 0), card('H-10', 1), card('D-A')];
    const ctx = { ...normal, dulleRule: 'secondInLastTrick' as const };
    expect(trickWinnerIndex(t, ctx, false)).toBe(1);
    expect(trickWinnerIndex(t, ctx, true)).toBe(2);
  });

  it('Schweinchen schlägt die Dulle', () => {
    const t = [card('H-10'), card('D-A'), card('C-Q'), card('D-9')];
    expect(trickWinnerIndex(t, { ...normal, schweinchen: true }, false)).toBe(1);
    expect(trickWinnerIndex(t, normal, false)).toBe(0);
  });

  it('Fleischloser: Zehn schlägt König', () => {
    const ctx: TrickContext = { mode: 'fleischlos', schweinchen: false, dulleRule: 'first' };
    expect(trickWinnerIndex([card('C-K'), card('C-10'), card('C-Q'), card('D-A')], ctx, false)).toBe(1);
  });
});

describe('Sortierung', () => {
  it('Trümpfe zuerst, von hoch nach niedrig', () => {
    const hand = [card('D-9'), card('C-A'), card('H-10'), card('C-Q'), card('D-J')];
    expect(sortHand(hand, normal)).toEqual([card('H-10'), card('C-Q'), card('D-J'), card('D-9'), card('C-A')]);
  });
});
