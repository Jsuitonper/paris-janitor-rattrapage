import type { PricingRule } from '../../types/pricing';
import { assertCents } from '../../utils/money';

export function computePriceHt(rule: PricingRule, qty: number): number {
  assertCents(rule.baseCents, 'baseCents');
  assertCents(rule.minCents, 'minCents');

  let total = rule.baseCents;
  let previousUpTo = 0;

  for (const tier of rule.tiers) {
    assertCents(tier.unitPriceCents, 'unitPriceCents');
    const tierEnd = tier.upToQty ?? Infinity;
    const unitsInTier = Math.max(0, Math.min(qty, tierEnd) - previousUpTo);
    total += unitsInTier * tier.unitPriceCents;
    if (qty <= tierEnd) break;
    previousUpTo = tierEnd;
  }

  return Math.max(rule.minCents, Math.round(total));
}
