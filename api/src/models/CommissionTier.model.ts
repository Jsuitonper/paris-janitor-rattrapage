import { Schema, model } from 'mongoose';

const commissionTierSchema = new Schema({
  upToCents: { type: Number, default: null },
  rateBps: { type: Number, required: true },
});

export const CommissionTierModel = model('CommissionTier', commissionTierSchema);
