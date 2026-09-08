import { Schema } from 'mongoose';
import { pricingRuleSchema } from './pricingRule.schema';

export const pricingSnapshotSchema = new Schema(
  {
    kind: { type: String, enum: ['service', 'stay'], required: true },
    unit: { type: String, required: true },
    qty: { type: Number, required: true },
    pricingRuleSnapshot: { type: pricingRuleSchema, required: true },
    grossHtCents: { type: Number, required: true },
    discountBps: { type: Number, required: true },
    discountHtCents: { type: Number, required: true },
    freeQuotaUsed: { type: Boolean, required: true },
    quotaWindowIndex: { type: Number, default: null },
    commissionBps: { type: Number, required: true },
    commissionHtCents: { type: Number, required: true },
    providerNetHtCents: { type: Number, required: true },
    platformMarginHtCents: { type: Number, required: true },
    vatRateBps: { type: Number, required: true },
    vatCents: { type: Number, required: true },
    travelerPaysHtCents: { type: Number, required: true },
    totalTtcCents: { type: Number, required: true },
  },
  { _id: false },
);
