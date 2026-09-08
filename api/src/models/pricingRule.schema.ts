import { Schema } from 'mongoose';

const pricingTierSchema = new Schema(
  {
    upToQty: { type: Number, default: null },
    unitPriceCents: { type: Number, required: true },
  },
  { _id: false },
);

export const pricingRuleSchema = new Schema(
  {
    unit: { type: String, enum: ['fixed', 'km', 'hour', 'm2', 'item', 'night'], required: true },
    baseCents: { type: Number, required: true },
    tiers: { type: [pricingTierSchema], required: true },
    minCents: { type: Number, required: true },
  },
  { _id: false },
);
