import { Schema, model } from 'mongoose';

const vipQuotaUsageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    windowMonths: { type: Number, required: true },
    windowIndex: { type: Number, required: true },
    serviceBookingId: { type: Schema.Types.ObjectId, ref: 'ServiceBooking', required: true },
  },
  { timestamps: true },
);

vipQuotaUsageSchema.index({ userId: 1, windowMonths: 1, windowIndex: 1 }, { unique: true });

export const VipQuotaUsageModel = model('VipQuotaUsage', vipQuotaUsageSchema);
