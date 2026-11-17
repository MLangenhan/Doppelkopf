import { describe, expect, it } from 'vitest';
import { applyFaceOrder, defaultFaceOrder, normalizeFaceOrder, orderFromHand, updateFaceOrder } from '../src/lib/handSort';

describe('Eigene Kartenreihenfolge', () => {
  it('Ziehen verschiebt nur die gezogene Kartenart', () => {
    const base = defaultFaceOrder();
    const before = applyFaceOrder(['C-A-0', 'H-10-0', 'D-9-0', 'C-Q-0'], base); // Dulle, Kreuz-Dame, Karo-9, Kreuz-Ass
    // Kreuz-Ass ganz nach vorne gezogen
    const after = ['C-A-0', ...before.filter((c) => c !== 'C-A-0')];
    const next = updateFaceOrder(base, before, after);
    expect(applyFaceOrder(before, next)).toEqual(after);
    expect(next.filter((f) => f !== 'C-A')).toEqual(base.filter((f) => f !== 'C-A'));
  });

  it('gilt in jedem Spiel: andere Hände sortieren sich nach derselben Rangfolge', () => {
    const base = defaultFaceOrder();
    const before = applyFaceOrder(['H-10-0', 'S-A-0'], base);
    const next = updateFaceOrder(base, before, ['S-A-0', 'H-10-0']);
    expect(applyFaceOrder(['H-10-1', 'C-Q-0', 'S-A-1'], next)).toEqual(['S-A-1', 'H-10-1', 'C-Q-0']);
  });

  it('übernimmt eine gezeigte Vorlage (z. B. nach Farben) als Startpunkt', () => {
    const hand = ['S-A-0', 'C-Q-0', 'H-10-0', 'D-9-0'];
    const order = orderFromHand(defaultFaceOrder(), hand);
    expect(applyFaceOrder(hand, order)).toEqual(hand);
  });

  it('kaputte Daten aus dem Profil werden repariert', () => {
    expect(normalizeFaceOrder('x')).toBeNull();
    const o = normalizeFaceOrder(['S-A', 'S-A', 'quatsch'])!;
    expect(o[0]).toBe('S-A');
    expect(o).toHaveLength(24);
  });
});
