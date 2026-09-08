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

export type PricingRule = {
  unit: PricingUnit;
  baseCents: number;
  tiers: { upToQty: number | null; unitPriceCents: number }[];
  minCents: number;
};

export type PricingSnapshot = {
  kind: 'service' | 'stay';
  unit: PricingUnit;
  qty: number;
  grossHtCents: number;
  discountBps: number;
  discountHtCents: number;
  freeQuotaUsed: boolean;
  vatRateBps: number;
  vatCents: number;
  travelerPaysHtCents: number;
  totalTtcCents: number;
};

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
};

export type ServiceCategory = { id: string; name: string; slug: string; description: string };

export type ServiceOffering = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  pricingRule: PricingRule;
  vatRateBps: number;
  vipOnly: boolean;
};

export type BookingStatus = 'requested' | 'confirmed' | 'completed' | 'cancelled';

export type StayBooking = {
  id: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  nights: number;
  guests: number;
  status: BookingStatus;
  paymentStatus: string;
  pricing: PricingSnapshot;
  createdAt: string;
};

export type ServiceBooking = {
  id: string;
  offeringId: string;
  qty: number;
  scheduledAt: string;
  status: BookingStatus;
  paymentStatus: string;
  pricing: PricingSnapshot;
  createdAt: string;
};

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

export type SubscriptionView = {
  vip: {
    tier: VipTier;
    status: string;
    anchorAt: string | null;
    currentPeriodEnd: string | null;
    stripeSubscriptionId: string | null;
    cancelAtPeriodEnd: boolean;
    interval: 'monthly' | 'yearly' | null;
  };
  effectiveTier: VipTier;
  plan: VipPlan;
  quota: { windowMonths: number; windowIndex: number; start: string; end: string; used: boolean; maxAmountTtcCents: number | null } | null;
};

export type Payment = {
  id: string;
  paymentIntentId: string;
  bookingKind: 'stay' | 'service';
  bookingId: string;
  amountCents: number;
  currency: string;
  status: 'requires_payment_method' | 'processing' | 'succeeded' | 'failed' | 'amount_mismatch';
  lastError: string | null;
  createdAt: string;
};

export type InvoiceLine = {
  label: string;
  qty: number;
  unitLabel: string;
  performedAt: string;
  grossHtCents: number;
  discountHtCents: number;
  netHtCents: number;
  vatRateBps: number;
  vatCents: number;
  totalTtcCents: number;
};

export type Invoice = {
  id: string;
  type: 'traveler' | 'provider';
  number: string;
  issuedAt: string;
  lines: InvoiceLine[];
  totals: { grossHtCents: number; discountHtCents: number; netHtCents: number; vatCents: number; totalTtcCents: number };
  gridFsId: string;
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

export type SimulationBreakdown = {
  assumptions: {
    nightlyRateHtCents: number;
    occupancyRateBps: number;
    occupiedNights: number;
    averageStayNights: number;
    estimatedStays: number;
    commissionBps: number;
  };
  grossRevenueHtCents: number;
  charges: {
    platformCommissionHtCents: number;
    ownerYearlyFeeCents: number;
    options: { key: string; label: string; frequency: 'per_stay' | 'per_year'; unitPriceHtCents: number; quantity: number; totalHtCents: number }[];
    optionsHtCents: number;
    totalHtCents: number;
  };
  net: { yearlyHtCents: number; monthlyHtCents: number; perOccupiedNightHtCents: number };
};
