import { Types } from 'mongoose';
import { InterventionSheetModel } from '../models/InterventionSheet.model';
import type { InterventionPrefill, InterventionReport, InterventionSheet } from '../types/intervention';

type SheetDoc = Omit<InterventionSheet, 'id' | 'bookingId' | 'providerId' | 'travelerId' | 'completedByUserId'> & {
  _id: Types.ObjectId;
  bookingId: Types.ObjectId;
  providerId: Types.ObjectId;
  travelerId: Types.ObjectId;
  completedByUserId: Types.ObjectId | null;
};

export type InterventionSheetInput = {
  bookingId: string;
  providerId: string;
  travelerId: string;
  prefill: InterventionPrefill;
};

function toSheet(doc: SheetDoc): InterventionSheet {
  return {
    id: doc._id.toString(),
    bookingId: doc.bookingId.toString(),
    providerId: doc.providerId.toString(),
    travelerId: doc.travelerId.toString(),
    status: doc.status,
    prefill: doc.prefill,
    report: doc.report ?? null,
    completedByUserId: doc.completedByUserId ? doc.completedByUserId.toString() : null,
    completedAt: doc.completedAt ?? null,
    createdAt: doc.createdAt,
  };
}

export async function createSheet(input: InterventionSheetInput): Promise<InterventionSheet | null> {
  try {
    const doc = await InterventionSheetModel.create(input);
    return toSheet(doc.toObject() as SheetDoc);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 11000) return null;
    throw error;
  }
}

export async function findSheetById(id: string): Promise<InterventionSheet | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  const doc = await InterventionSheetModel.findById(id).lean<SheetDoc>();
  return doc ? toSheet(doc) : null;
}

export async function findSheetByBooking(bookingId: string): Promise<InterventionSheet | null> {
  if (!Types.ObjectId.isValid(bookingId)) return null;
  const doc = await InterventionSheetModel.findOne({ bookingId }).lean<SheetDoc>();
  return doc ? toSheet(doc) : null;
}

export async function listSheets(filter: { status?: string; travelerId?: string } = {}): Promise<InterventionSheet[]> {
  const docs = await InterventionSheetModel.find(filter).sort({ 'prefill.scheduledAt': -1 }).lean<SheetDoc[]>();
  return docs.map(toSheet);
}

export async function completeSheet(
  id: string,
  report: InterventionReport,
  completedByUserId: string,
): Promise<InterventionSheet | null> {
  const doc = await InterventionSheetModel.findByIdAndUpdate(
    id,
    { $set: { report, status: 'completed', completedByUserId, completedAt: new Date() } },
    { returnDocument: 'after', runValidators: true },
  ).lean<SheetDoc>();
  return doc ? toSheet(doc) : null;
}

export async function deleteSheetForBooking(bookingId: string): Promise<void> {
  await InterventionSheetModel.deleteOne({ bookingId });
}
