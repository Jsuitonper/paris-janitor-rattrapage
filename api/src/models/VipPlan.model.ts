import { Schema, model } from 'mongoose';

const freeQuotaSchema = new Schema(
  {
    windowMonths: { type: Number, required: true },
    maxAmountTtcCents: { type: Number, default: null },
  },
  { _id: false },
);

const vipPlanSchema = new Schema({
  tier: { type: String, enum: ['free', 'bagpacker', 'explorator'], required: true, unique: true },
  monthlyPriceCents: { type: Number, required: true },
  yearlyPriceCents: { type: Number, required: true },
  discountBps: { type: Number, required: true },
  freeQuota: { type: freeQuotaSchema, default: null },
  showAds: { type: Boolean, required: true },
  priorityAccess: { type: Boolean, required: true },
  renewalBonusBps: { type: Number, required: true },
});

export const VipPlanModel = model('VipPlan', vipPlanSchema);
