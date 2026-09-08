import { Schema, model } from 'mongoose';
import { pricingRuleSchema } from './pricingRule.schema';

const serviceOfferingSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    categoryId: { type: Schema.Types.ObjectId, ref: 'ServiceCategory', required: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider', required: true },
    pricingRule: { type: pricingRuleSchema, required: true },
    vatRateBps: { type: Number, default: 2000 },
    vipOnly: { type: Boolean, default: false },
    priorityAccess: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const ServiceOfferingModel = model('ServiceOffering', serviceOfferingSchema);
