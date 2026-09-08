import type { CommissionTier, PricingRule, PricingSnapshot, VipContext } from '../../types/pricing';
import { bpsOf } from '../../utils/money';
import { computeCommission } from './commission';
import { computePriceHt } from './pricingEngine';
import { discountFor, freeQuotaEligibility } from './vipBenefits';

export type ServiceQuoteInput = {
  pricingRule: PricingRule;
  qty: number;
  vatRateBps: number;
  commissionTiers: CommissionTier[];
  vip: VipContext;
  at: Date;
};

export type StayQuoteInput = {
  nights: number;
  nightlyRateHtCents: number;
  vatRateBps: number;
  stayCommissionBps: number;
};

export function quoteService(input: ServiceQuoteInput): PricingSnapshot {
  const grossHtCents = computePriceHt(input.pricingRule, input.qty);
  const grossTtcCents = grossHtCents + bpsOf(grossHtCents, input.vatRateBps);

  const quota = freeQuotaEligibility(input.vip, grossTtcCents, input.at);
  const discount = quota.eligible ? { bps: 10000, cents: grossHtCents } : discountFor(input.vip.plan, grossHtCents);
  const travelerPaysHtCents = grossHtCents - discount.cents;

  const commission = computeCommission(grossHtCents, input.commissionTiers);
  const vatCents = bpsOf(travelerPaysHtCents, input.vatRateBps);

  return {
    kind: 'service',
    unit: input.pricingRule.unit,
    qty: input.qty,
    pricingRuleSnapshot: structuredClone(input.pricingRule),
    grossHtCents,
    discountBps: discount.bps,
    discountHtCents: discount.cents,
    freeQuotaUsed: quota.eligible,
    quotaWindowIndex: quota.eligible ? quota.windowIndex : null,
    commissionBps: commission.bps,
    commissionHtCents: commission.cents,
    providerNetHtCents: grossHtCents - commission.cents,
    platformMarginHtCents: commission.cents - discount.cents,
    vatRateBps: input.vatRateBps,
    vatCents,
    travelerPaysHtCents,
    totalTtcCents: travelerPaysHtCents + vatCents,
  };
}

export function quoteStay(input: StayQuoteInput): PricingSnapshot {
  const rule: PricingRule = {
    unit: 'night',
    baseCents: 0,
    tiers: [{ upToQty: null, unitPriceCents: input.nightlyRateHtCents }],
    minCents: 100,
  };
  const grossHtCents = computePriceHt(rule, input.nights);
  const commissionHtCents = bpsOf(grossHtCents, input.stayCommissionBps);
  const vatCents = bpsOf(grossHtCents, input.vatRateBps);

  return {
    kind: 'stay',
    unit: 'night',
    qty: input.nights,
    pricingRuleSnapshot: rule,
    grossHtCents,
    discountBps: 0,
    discountHtCents: 0,
    freeQuotaUsed: false,
    quotaWindowIndex: null,
    commissionBps: input.stayCommissionBps,
    commissionHtCents,
    providerNetHtCents: grossHtCents - commissionHtCents,
    platformMarginHtCents: commissionHtCents,
    vatRateBps: input.vatRateBps,
    vatCents,
    travelerPaysHtCents: grossHtCents,
    totalTtcCents: grossHtCents + vatCents,
  };
}
