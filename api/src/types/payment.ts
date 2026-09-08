export type BookingKind = 'stay' | 'service';

export type PaymentIntentStatus = 'requires_payment_method' | 'processing' | 'succeeded' | 'failed' | 'amount_mismatch';

export type Payment = {
  id: string;
  paymentIntentId: string;
  bookingKind: BookingKind;
  bookingId: string;
  travelerId: string;
  amountCents: number;
  currency: string;
  status: PaymentIntentStatus;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};
