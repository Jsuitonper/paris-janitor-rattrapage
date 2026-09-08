import type { PricingRule } from './pricing';

export type ProviderStatus = 'candidate' | 'validated' | 'suspended';

export type Provider = {
  id: string;
  name: string;
  job: string;
  email: string;
  phone: string | null;
  status: ProviderStatus;
  ratingCount: number;
  ratingSum: number;
  createdAt: Date;
};

export type ServiceCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
};

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
  createdAt: Date;
};

export type PropertyStatus = 'draft' | 'pending' | 'published' | 'rejected';

export type DateRange = { start: Date; end: Date };

export type PropertyAddress = {
  street: string;
  postalCode: string;
  city: string;
  arrondissement: number;
};

export type Property = {
  id: string;
  title: string;
  description: string;
  address: PropertyAddress;
  capacity: number;
  bedrooms: number;
  surfaceM2: number;
  amenities: string[];
  nightlyRateHtCents: number;
  vatRateBps: number;
  photoIds: string[];
  blockedRanges: DateRange[];
  status: PropertyStatus;
  rejectionReason: string | null;
  createdAt: Date;
};

import type { SimulatorOption } from './lead';

export type PlatformSettings = {
  stayCommissionBps: number;
  ownerYearlyFeeCents: number;
  simulatorOptions: SimulatorOption[];
};
