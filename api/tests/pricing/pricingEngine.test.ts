import { describe, expect, it } from 'vitest';
import { computePriceHt } from '../../src/services/pricing/pricingEngine';
import { fixedRule, taxiRule } from './fixtures';

describe('computePriceHt', () => {
  it.each([
    [5, 1000],
    [10, 2000],
    [10.5, 2075],
    [30, 5000],
  ])('taxi 2 €/km jusqu’à 10 km puis 1,50 €/km : %s km → %s centimes', (km, expected) => {
    expect(computePriceHt(taxiRule, km)).toBe(expected);
  });

  it('ajoute la part fixe avant les paliers', () => {
    expect(computePriceHt({ ...taxiRule, baseCents: 500 }, 5)).toBe(1500);
  });

  it('un prix fixe ignore la quantité', () => {
    expect(computePriceHt(fixedRule(18000), 1)).toBe(18000);
    expect(computePriceHt(fixedRule(18000), 7)).toBe(18000);
  });

  it('remonte un résultat de 40 centimes au plancher de 100', () => {
    const rule = { unit: 'item' as const, baseCents: 0, tiers: [{ upToQty: null, unitPriceCents: 40 }], minCents: 100 };
    expect(computePriceHt(rule, 1)).toBe(100);
  });

  it('arrondit une seule fois, en sortie, pour une quantité fractionnaire', () => {
    const rule = { unit: 'hour' as const, baseCents: 0, tiers: [{ upToQty: null, unitPriceCents: 333 }], minCents: 100 };
    const price = computePriceHt(rule, 1.5);
    expect(price).toBe(500);
    expect(Number.isInteger(price)).toBe(true);
  });

  it('refuse un tarif qui n’est pas un entier de centimes', () => {
    expect(() => computePriceHt({ ...taxiRule, baseCents: 0.5 }, 1)).toThrow();
    expect(() => computePriceHt({ ...taxiRule, tiers: [{ upToQty: null, unitPriceCents: 1.99 }] }, 1)).toThrow();
  });
});
