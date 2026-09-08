import { describe, expect, it } from 'vitest';
import { assertCents, bpsOf, sumCents } from '../../src/utils/money';

describe('bpsOf', () => {
  it('applique un taux en points de base et arrondit au centime', () => {
    expect(bpsOf(10000, 500)).toBe(500);
    expect(bpsOf(333, 2000)).toBe(67);
    expect(bpsOf(2075, 500)).toBe(104);
  });

  it('refuse un montant ou un taux non entier', () => {
    expect(() => bpsOf(10.5, 500)).toThrow();
    expect(() => bpsOf(1000, 5.5)).toThrow();
  });
});

describe('sumCents', () => {
  it('additionne des entiers', () => {
    expect(sumCents([100, 250, 1])).toBe(351);
    expect(sumCents([])).toBe(0);
  });

  it('refuse un flottant dans la liste', () => {
    expect(() => sumCents([100, 0.1])).toThrow();
  });
});

describe('assertCents', () => {
  it('nomme le champ fautif', () => {
    expect(() => assertCents(1.5, 'vatCents')).toThrow('vatCents');
  });
});
