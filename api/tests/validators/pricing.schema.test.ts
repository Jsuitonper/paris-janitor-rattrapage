import { describe, expect, it } from 'vitest';
import { commissionTiersSchema, pricingRuleSchema } from '../../src/validators/pricing.schema';

const taxi = {
  unit: 'km',
  baseCents: 500,
  tiers: [
    { upToQty: 10, unitPriceCents: 200 },
    { upToQty: null, unitPriceCents: 150 },
  ],
  minCents: 100,
};

describe('pricingRuleSchema', () => {
  it('accepte un barème à paliers croissants terminé par un palier ouvert', () => {
    expect(pricingRuleSchema.safeParse(taxi).success).toBe(true);
  });

  it('refuse des paliers désordonnés', () => {
    const rule = { ...taxi, tiers: [{ upToQty: 10, unitPriceCents: 200 }, { upToQty: 5, unitPriceCents: 150 }, { upToQty: null, unitPriceCents: 100 }] };
    expect(pricingRuleSchema.safeParse(rule).success).toBe(false);
  });

  it('refuse un palier ouvert qui n’est pas en dernière position', () => {
    const rule = { ...taxi, tiers: [{ upToQty: null, unitPriceCents: 200 }, { upToQty: 10, unitPriceCents: 150 }] };
    expect(pricingRuleSchema.safeParse(rule).success).toBe(false);
  });

  it('refuse un dernier palier fermé', () => {
    const rule = { ...taxi, tiers: [{ upToQty: 10, unitPriceCents: 200 }] };
    expect(pricingRuleSchema.safeParse(rule).success).toBe(false);
  });

  it('refuse un plancher inférieur à 100 centimes et les montants non entiers', () => {
    expect(pricingRuleSchema.safeParse({ ...taxi, minCents: 50 }).success).toBe(false);
    expect(pricingRuleSchema.safeParse({ ...taxi, baseCents: 1.5 }).success).toBe(false);
  });

  it('refuse l’unité night, réservée aux séjours', () => {
    expect(pricingRuleSchema.safeParse({ ...taxi, unit: 'night' }).success).toBe(false);
  });
});

describe('commissionTiersSchema', () => {
  it('accepte le barème de l’annexe 1', () => {
    const tiers = [
      { upToCents: 500, rateBps: 2000 },
      { upToCents: 4500, rateBps: 1500 },
      { upToCents: null, rateBps: 700 },
    ];
    expect(commissionTiersSchema.safeParse(tiers).success).toBe(true);
  });

  it('refuse un barème sans palier ouvert final ou non croissant', () => {
    expect(commissionTiersSchema.safeParse([{ upToCents: 500, rateBps: 2000 }]).success).toBe(false);
    expect(
      commissionTiersSchema.safeParse([
        { upToCents: 4500, rateBps: 2000 },
        { upToCents: 500, rateBps: 1500 },
        { upToCents: null, rateBps: 700 },
      ]).success,
    ).toBe(false);
  });
});
