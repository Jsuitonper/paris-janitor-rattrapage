import { Types } from 'mongoose';
import { PaymentModel } from '../models/Payment.model';
import type { BookingKind, Payment, PaymentIntentStatus } from '../types/payment';

type PaymentDoc = Omit<Payment, 'id' | 'bookingId' | 'travelerId'> & {
  _id: Types.ObjectId;
  bookingId: Types.ObjectId;
  travelerId: Types.ObjectId;
};

export type PaymentInput = {
  paymentIntentId: string;
  bookingKind: BookingKind;
  bookingId: string;
  travelerId: string;
  amountCents: number;
  currency: string;
  status: PaymentIntentStatus;
  lastError?: string | null;
};

function toPayment(doc: PaymentDoc): Payment {
  return {
    id: doc._id.toString(),
    paymentIntentId: doc.paymentIntentId,
    bookingKind: doc.bookingKind,
    bookingId: doc.bookingId.toString(),
    travelerId: doc.travelerId.toString(),
    amountCents: doc.amountCents,
    currency: doc.currency,
    status: doc.status,
    lastError: doc.lastError ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function createPayment(input: PaymentInput): Promise<Payment> {
  const doc = await PaymentModel.create(input);
  return toPayment(doc.toObject() as PaymentDoc);
}

export async function upsertPaymentFromIntent(input: PaymentInput): Promise<Payment> {
  const doc = await PaymentModel.findOneAndUpdate(
    { paymentIntentId: input.paymentIntentId },
    { $set: input },
    { upsert: true, returnDocument: 'after' },
  ).lean<PaymentDoc>();
  return toPayment(doc!);
}

export async function findLatestPaymentForBooking(bookingKind: BookingKind, bookingId: string): Promise<Payment | null> {
  const doc = await PaymentModel.findOne({ bookingKind, bookingId }).sort({ createdAt: -1 }).lean<PaymentDoc>();
  return doc ? toPayment(doc) : null;
}

export async function listPayments(filter: { travelerId?: string } = {}): Promise<Payment[]> {
  const docs = await PaymentModel.find(filter).sort({ createdAt: -1 }).lean<PaymentDoc[]>();
  return docs.map(toPayment);
}
