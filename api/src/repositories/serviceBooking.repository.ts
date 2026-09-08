import { Types } from 'mongoose';
import { ServiceBookingModel } from '../models/ServiceBooking.model';
import type { BookingStatus, PaymentStatus, ServiceBooking } from '../types/booking';
import type { PricingSnapshot } from '../types/pricing';

type ServiceDoc = Omit<ServiceBooking, 'id' | 'travelerId' | 'offeringId' | 'providerId' | 'stayBookingId'> & {
  _id: Types.ObjectId;
  travelerId: Types.ObjectId;
  offeringId: Types.ObjectId;
  providerId: Types.ObjectId;
  stayBookingId: Types.ObjectId | null;
};

export type ServiceBookingInput = {
  travelerId: string;
  offeringId: string;
  providerId: string;
  stayBookingId: string | null;
  qty: number;
  scheduledAt: Date;
  notes: string;
  paymentStatus?: PaymentStatus;
  pricing: PricingSnapshot;
};

export type ServiceBookingFilter = {
  travelerId?: string;
  providerId?: string;
  status?: BookingStatus;
  completedBetween?: { from: Date; to: Date };
};

function toService(doc: ServiceDoc): ServiceBooking {
  return {
    id: doc._id.toString(),
    travelerId: doc.travelerId.toString(),
    offeringId: doc.offeringId.toString(),
    providerId: doc.providerId.toString(),
    stayBookingId: doc.stayBookingId ? doc.stayBookingId.toString() : null,
    qty: doc.qty,
    scheduledAt: doc.scheduledAt,
    notes: doc.notes ?? '',
    status: doc.status,
    paymentStatus: doc.paymentStatus,
    pricing: doc.pricing,
    createdAt: doc.createdAt,
  };
}

export async function createServiceBooking(input: ServiceBookingInput): Promise<ServiceBooking> {
  const doc = await ServiceBookingModel.create(input);
  return toService(doc.toObject() as ServiceDoc);
}

export async function findServiceBookingById(id: string): Promise<ServiceBooking | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  const doc = await ServiceBookingModel.findById(id).lean<ServiceDoc>();
  return doc ? toService(doc) : null;
}

export async function listServiceBookings(filter: ServiceBookingFilter = {}): Promise<ServiceBooking[]> {
  const query: Record<string, unknown> = {};
  if (filter.travelerId) query.travelerId = filter.travelerId;
  if (filter.providerId) query.providerId = filter.providerId;
  if (filter.status) query.status = filter.status;
  if (filter.completedBetween) query.scheduledAt = { $gte: filter.completedBetween.from, $lt: filter.completedBetween.to };
  const docs = await ServiceBookingModel.find(query).sort({ createdAt: -1 }).lean<ServiceDoc[]>();
  return docs.map(toService);
}

export async function updateServiceBooking(
  id: string,
  patch: { status?: BookingStatus; paymentStatus?: PaymentStatus },
): Promise<ServiceBooking | null> {
  const doc = await ServiceBookingModel.findByIdAndUpdate(id, { $set: patch }, { returnDocument: 'after' }).lean<ServiceDoc>();
  return doc ? toService(doc) : null;
}

export async function deleteServiceBooking(id: string): Promise<void> {
  await ServiceBookingModel.findByIdAndDelete(id);
}
