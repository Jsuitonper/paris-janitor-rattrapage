import type { PricingSnapshot } from './pricing';

export type BookingStatus = 'requested' | 'confirmed' | 'completed' | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'payment_failed';

export type StayBooking = {
  id: string;
  travelerId: string;
  propertyId: string;
  startDate: Date;
  endDate: Date;
  nights: number;
  guests: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  pricing: PricingSnapshot;
  createdAt: Date;
};

export type ServiceBooking = {
  id: string;
  travelerId: string;
  offeringId: string;
  providerId: string;
  stayBookingId: string | null;
  qty: number;
  scheduledAt: Date;
  notes: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  pricing: PricingSnapshot;
  createdAt: Date;
};

export type VipQuotaUsage = {
  id: string;
  userId: string;
  windowMonths: number;
  windowIndex: number;
  serviceBookingId: string;
};
