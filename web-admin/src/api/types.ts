export type Role = 'traveler' | 'admin';

export type VipTier = 'free' | 'bagpacker' | 'explorator';

export type User = {
  id: string;
  email: string;
  role: Role;
  profile: { firstName: string; lastName: string; phone?: string };
  vip: { tier: VipTier; status: string; anchorAt: string | null; currentPeriodEnd: string | null };
  blocked: boolean;
  createdAt: string;
};

export type AuthResult = { user: User; token: string };

export type PricingUnit = 'fixed' | 'km' | 'hour' | 'm2' | 'item' | 'night';

export type PricingTier = { upToQty: number | null; unitPriceCents: number };

export type PricingRule = {
  unit: PricingUnit;
  baseCents: number;
  tiers: PricingTier[];
  minCents: number;
};

export type Provider = {
  id: string;
  name: string;
  job: string;
  email: string;
  phone: string | null;
  status: 'candidate' | 'validated' | 'suspended';
  ratingCount: number;
  ratingSum: number;
};

export type ServiceCategory = { id: string; name: string; slug: string; description: string };

export type ServiceOffering = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  providerId: string;
  pricingRule: PricingRule;
  vatRateBps: number;
  vipOnly: boolean;
  priorityAccess: boolean;
  active: boolean;
};

export type PropertyStatus = 'draft' | 'pending' | 'published' | 'rejected';

export type Property = {
  id: string;
  title: string;
  description: string;
  address: { street: string; postalCode: string; city: string; arrondissement: number };
  capacity: number;
  bedrooms: number;
  surfaceM2: number;
  amenities: string[];
  nightlyRateHtCents: number;
  vatRateBps: number;
  photoIds: string[];
  blockedRanges: { start: string; end: string }[];
  status: PropertyStatus;
  rejectionReason: string | null;
};

export type CommissionTier = { upToCents: number | null; rateBps: number };

export type VipPlan = {
  tier: VipTier;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  discountBps: number;
  freeQuota: { windowMonths: number; maxAmountTtcCents: number | null } | null;
  showAds: boolean;
  priorityAccess: boolean;
  renewalBonusBps: number;
};

export type PlatformSettings = { stayCommissionBps: number; ownerYearlyFeeCents: number; simulatorOptions: SimulatorOption[] };

export type InvoiceLine = {
  label: string;
  qty: number;
  unitLabel: string;
  bookingKind: 'stay' | 'service';
  bookingId: string;
  performedAt: string;
  grossHtCents: number;
  discountHtCents: number;
  netHtCents: number;
  commissionBps: number;
  commissionHtCents: number;
  providerNetHtCents: number;
  vatRateBps: number;
  vatCents: number;
  totalTtcCents: number;
};

export type Invoice = {
  id: string;
  type: 'traveler' | 'provider';
  number: string;
  travelerId: string | null;
  providerId: string | null;
  period: { year: number; month: number } | null;
  party: { name: string; email: string; detail: string };
  lines: InvoiceLine[];
  totals: {
    grossHtCents: number;
    discountHtCents: number;
    netHtCents: number;
    commissionHtCents: number;
    providerNetHtCents: number;
    vatCents: number;
    totalTtcCents: number;
  };
  gridFsId: string;
  payoutStatus: 'not_applicable' | 'pending' | 'sent';
  payoutAt: string | null;
  issuedAt: string;
};

export type InterventionSheet = {
  id: string;
  bookingId: string;
  status: 'prefilled' | 'completed';
  prefill: {
    offeringName: string;
    providerName: string;
    travelerName: string;
    address: string;
    scheduledAt: string;
    qty: number;
    unitLabel: string;
  };
  report: {
    performedAt: string;
    durationMinutes: number;
    workDone: string;
    materialsUsed: string;
    incidents: string;
    attachmentIds: string[];
  } | null;
  completedAt: string | null;
};

export type Review = {
  id: string;
  bookingId: string;
  providerId: string;
  offeringId: string;
  rating: number;
  comment: string;
  moderation: 'pending' | 'approved' | 'rejected';
  moderationReason: string | null;
  authorName: string;
  createdAt: string;
};

export type Message = {
  id: string;
  authorRole: 'traveler' | 'concierge';
  authorName: string;
  body: string;
  createdAt: string;
};

export type MessageThread = {
  id: string;
  bookingId: string;
  subject: string;
  lastMessageAt: string | null;
  unreadForAdmin: number;
  unreadForTraveler: number;
};

export type SimulatorOption = {
  key: string;
  label: string;
  priceHtCents: number;
  frequency: 'per_stay' | 'per_year';
};

export type QuoteLead = {
  id: string;
  input: {
    arrondissement: number;
    surfaceM2: number;
    capacity: number;
    bedrooms: number;
    nightlyRateHtCents: number;
    occupancyRateBps: number;
    averageStayNights: number;
    optionKeys: string[];
  };
  breakdown: {
    assumptions: { occupiedNights: number; estimatedStays: number; commissionBps: number };
    grossRevenueHtCents: number;
    charges: { platformCommissionHtCents: number; ownerYearlyFeeCents: number; optionsHtCents: number; totalHtCents: number };
    net: { yearlyHtCents: number; monthlyHtCents: number; perOccupiedNightHtCents: number };
  };
  contact: { firstName: string; lastName: string; email: string; phone: string } | null;
  status: 'new' | 'contacted' | 'converted' | 'archived';
  notes: string;
  createdAt: string;
};
