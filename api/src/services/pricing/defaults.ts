import type { CommissionTier, VipPlan } from '../../types/pricing';

export const DEFAULT_COMMISSION_TIERS: CommissionTier[] = [
  { upToCents: 500, rateBps: 2000 },
  { upToCents: 4500, rateBps: 1500 },
  { upToCents: 7500, rateBps: 1100 },
  { upToCents: 14000, rateBps: 900 },
  { upToCents: null, rateBps: 700 },
];

export const DEFAULT_VIP_PLANS: VipPlan[] = [
  {
    tier: 'free',
    monthlyPriceCents: 0,
    yearlyPriceCents: 0,
    discountBps: 0,
    freeQuota: null,
    showAds: true,
    priorityAccess: false,
    renewalBonusBps: 0,
  },
  {
    tier: 'bagpacker',
    monthlyPriceCents: 990,
    yearlyPriceCents: 11300,
    discountBps: 0,
    freeQuota: { windowMonths: 12, maxAmountTtcCents: 8000 },
    showAds: false,
    priorityAccess: false,
    renewalBonusBps: 0,
  },
  {
    tier: 'explorator',
    monthlyPriceCents: 1900,
    yearlyPriceCents: 22000,
    discountBps: 500,
    freeQuota: { windowMonths: 6, maxAmountTtcCents: null },
    showAds: false,
    priorityAccess: true,
    renewalBonusBps: 1000,
  },
];

export const DEFAULT_SIMULATOR_OPTIONS = [
  { key: 'cleaning', label: 'Ménage après chaque séjour', priceHtCents: 5000, frequency: 'per_stay' as const },
  { key: 'linen', label: 'Fourniture du linge de maison', priceHtCents: 2500, frequency: 'per_stay' as const },
  { key: 'checkin', label: 'Check-in et check-out des voyageurs', priceHtCents: 2000, frequency: 'per_stay' as const },
  { key: 'photos', label: 'Photos professionnelles du logement', priceHtCents: 18000, frequency: 'per_year' as const },
  { key: 'pricing', label: 'Optimisation tarifaire des nuitées', priceHtCents: 12000, frequency: 'per_year' as const },
];
