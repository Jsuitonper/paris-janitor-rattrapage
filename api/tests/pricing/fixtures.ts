import { expect } from 'vitest';
import { DEFAULT_VIP_PLANS } from '../../src/services/pricing/defaults';
import type { PricingRule, PricingSnapshot, VipContext, VipPlan, VipTier } from '../../src/types/pricing';

export const ANCHOR = new Date('2025-03-15T00:00:00Z');

export const taxiRule: PricingRule = {
  unit: 'km',
  baseCents: 0,
  tiers: [
    { upToQty: 10, unitPriceCents: 200 },
    { upToQty: null, unitPriceCents: 150 },
  ],
  minCents: 100,
};

export function fixedRule(priceCents: number): PricingRule {
  return { unit: 'fixed', baseCents: priceCents, tiers: [{ upToQty: null, unitPriceCents: 0 }], minCents: 100 };
}

export function planFor(tier: VipTier): VipPlan {
  return DEFAULT_VIP_PLANS.find((plan) => plan.tier === tier)!;
}

export function vipContext(tier: VipTier, usedWindowIndexes: number[] = []): VipContext {
  return { plan: planFor(tier), anchorAt: tier === 'free' ? null : ANCHOR, usedWindowIndexes };
}

export function expectIntegerCents(snapshot: PricingSnapshot): void {
  for (const [key, value] of Object.entries(snapshot)) {
    if (key.endsWith('Cents')) {
      expect(Number.isInteger(value), `${key} doit être un entier`).toBe(true);
    }
  }
}
