import { Schema, model } from 'mongoose';

const providerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    job: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: null },
    status: { type: String, enum: ['candidate', 'validated', 'suspended'], default: 'candidate' },
    ratingCount: { type: Number, default: 0 },
    ratingSum: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const ProviderModel = model('Provider', providerSchema);
