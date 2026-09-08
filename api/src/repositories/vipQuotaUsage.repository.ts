import { Types } from 'mongoose';
import { VipQuotaUsageModel } from '../models/VipQuotaUsage.model';
import type { VipQuotaUsage } from '../types/booking';

type UsageDoc = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  windowMonths: number;
  windowIndex: number;
  serviceBookingId: Types.ObjectId;
};

function toUsage(doc: UsageDoc): VipQuotaUsage {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    windowMonths: doc.windowMonths,
    windowIndex: doc.windowIndex,
    serviceBookingId: doc.serviceBookingId.toString(),
  };
}

export async function listUsedWindowIndexes(userId: string, windowMonths: number): Promise<number[]> {
  const docs = await VipQuotaUsageModel.find({ userId, windowMonths }).lean<UsageDoc[]>();
  return docs.map((doc) => doc.windowIndex);
}

export async function reserveQuota(input: {
  userId: string;
  windowMonths: number;
  windowIndex: number;
  serviceBookingId: string;
}): Promise<VipQuotaUsage | null> {
  try {
    const doc = await VipQuotaUsageModel.create(input);
    return toUsage(doc.toObject() as UsageDoc);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 11000) return null;
    throw error;
  }
}

export async function releaseQuotaForBooking(serviceBookingId: string): Promise<boolean> {
  const result = await VipQuotaUsageModel.deleteOne({ serviceBookingId });
  return result.deletedCount > 0;
}
