export type PricingUnit = 'fixed' | 'km' | 'hour' | 'm2' | 'item' | 'night';

export type PricingTier = {
  upToQty: number | null;
  unitPriceCents: number;
};

export type PricingRule = {
  unit: PricingUnit;
  baseCents: number;
  tiers: PricingTier[];
  minCents: number;
};

export type CommissionTier = {
  upToCents: number | null;
  rateBps: number;
};

export type VipTier = 'free' | 'bagpacker' | 'explorator';

export type FreeQuota = {
  windowMonths: number;
  maxAmountTtcCents: number | null;
};

export type VipPlan = {
  tier: VipTier;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  discountBps: number;
  freeQuota: FreeQuota | null;
  showAds: boolean;
  priorityAccess: boolean;
  renewalBonusBps: number;
};

export type VipContext = {
  plan: VipPlan;
  anchorAt: Date | null;
  usedWindowIndexes: number[];
};

export type PricingSnapshot = {
  kind: 'service' | 'stay';
  unit: PricingUnit;
  qty: number;
  pricingRuleSnapshot: PricingRule;
  grossHtCents: number;
  discountBps: number;
  discountHtCents: number;
  freeQuotaUsed: boolean;
  quotaWindowIndex: number | null;
  commissionBps: number;
  commissionHtCents: number;
  providerNetHtCents: number;
  platformMarginHtCents: number;
  vatRateBps: number;
  vatCents: number;
  travelerPaysHtCents: number;
  totalTtcCents: number;
};
