export type OptionFrequency = 'per_stay' | 'per_year';

export type SimulatorOption = {
  key: string;
  label: string;
  priceHtCents: number;
  frequency: OptionFrequency;
};

export type SimulationInput = {
  arrondissement: number;
  surfaceM2: number;
  capacity: number;
  bedrooms: number;
  nightlyRateHtCents: number;
  occupancyRateBps: number;
  averageStayNights: number;
  optionKeys: string[];
};

export type SimulationOptionLine = {
  key: string;
  label: string;
  frequency: OptionFrequency;
  unitPriceHtCents: number;
  quantity: number;
  totalHtCents: number;
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
    options: SimulationOptionLine[];
    optionsHtCents: number;
    totalHtCents: number;
  };
  net: {
    yearlyHtCents: number;
    monthlyHtCents: number;
    perOccupiedNightHtCents: number;
  };
};

export type LeadStatus = 'new' | 'contacted' | 'converted' | 'archived';

export type LeadContact = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type QuoteLead = {
  id: string;
  input: SimulationInput;
  breakdown: SimulationBreakdown;
  contact: LeadContact | null;
  status: LeadStatus;
  notes: string;
  createdAt: Date;
};
