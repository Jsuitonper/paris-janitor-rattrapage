import { Types } from 'mongoose';
import { StayBookingModel } from '../models/StayBooking.model';
import type { BookingStatus, PaymentStatus, StayBooking } from '../types/booking';
import type { PricingSnapshot } from '../types/pricing';

type StayDoc = Omit<StayBooking, 'id' | 'travelerId' | 'propertyId'> & {
  _id: Types.ObjectId;
  travelerId: Types.ObjectId;
  propertyId: Types.ObjectId;
};

export type StayBookingInput = {
  travelerId: string;
  propertyId: string;
  startDate: Date;
  endDate: Date;
  nights: number;
  guests: number;
  pricing: PricingSnapshot;
};

function toStay(doc: StayDoc): StayBooking {
  return {
    id: doc._id.toString(),
    travelerId: doc.travelerId.toString(),
    propertyId: doc.propertyId.toString(),
    startDate: doc.startDate,
    endDate: doc.endDate,
    nights: doc.nights,
    guests: doc.guests,
    status: doc.status,
    paymentStatus: doc.paymentStatus,
    pricing: doc.pricing,
    createdAt: doc.createdAt,
  };
}

export async function createStayBooking(input: StayBookingInput): Promise<StayBooking> {
  const doc = await StayBookingModel.create(input);
  return toStay(doc.toObject() as StayDoc);
}

export async function findStayBookingById(id: string): Promise<StayBooking | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  const doc = await StayBookingModel.findById(id).lean<StayDoc>();
  return doc ? toStay(doc) : null;
}

export async function listStayBookings(filter: { travelerId?: string; propertyId?: string; status?: BookingStatus } = {}): Promise<StayBooking[]> {
  const docs = await StayBookingModel.find(filter).sort({ createdAt: -1 }).lean<StayDoc[]>();
  return docs.map(toStay);
}

export async function existsOverlappingStay(propertyId: string, startDate: Date, endDate: Date): Promise<boolean> {
  const doc = await StayBookingModel.exists({
    propertyId,
    status: { $in: ['requested', 'confirmed'] },
    startDate: { $lt: endDate },
    endDate: { $gt: startDate },
  });
  return doc !== null;
}

export async function listActiveStayRanges(propertyId: string): Promise<{ start: Date; end: Date }[]> {
  const docs = await StayBookingModel.find({ propertyId, status: { $in: ['requested', 'confirmed'] } })
    .select('startDate endDate')
    .lean<{ startDate: Date; endDate: Date }[]>();
  return docs.map((doc) => ({ start: doc.startDate, end: doc.endDate }));
}

export async function updateStayBooking(
  id: string,
  patch: { status?: BookingStatus; paymentStatus?: PaymentStatus },
): Promise<StayBooking | null> {
  const doc = await StayBookingModel.findByIdAndUpdate(id, { $set: patch }, { returnDocument: 'after' }).lean<StayDoc>();
  return doc ? toStay(doc) : null;
}
