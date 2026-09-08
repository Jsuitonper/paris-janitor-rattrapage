import type { BookingKind } from './payment';

export type InvoiceType = 'traveler' | 'provider';

export type PayoutStatus = 'not_applicable' | 'pending' | 'sent';

export type InvoicePeriod = { year: number; month: number };

export type InvoiceLine = {
  label: string;
  qty: number;
  unitLabel: string;
  bookingKind: BookingKind;
  bookingId: string;
  performedAt: Date;
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

export type InvoiceTotals = {
  grossHtCents: number;
  discountHtCents: number;
  netHtCents: number;
  commissionHtCents: number;
  providerNetHtCents: number;
  vatCents: number;
  totalTtcCents: number;
};

export type InvoiceParty = {
  name: string;
  email: string;
  detail: string;
};

export type Invoice = {
  id: string;
  type: InvoiceType;
  number: string;
  travelerId: string | null;
  providerId: string | null;
  booking: { kind: BookingKind; id: string } | null;
  period: InvoicePeriod | null;
  party: InvoiceParty;
  lines: InvoiceLine[];
  totals: InvoiceTotals;
  gridFsId: string;
  payoutStatus: PayoutStatus;
  payoutAt: Date | null;
  issuedAt: Date;
};
