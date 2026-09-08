import { Schema, model } from 'mongoose';

const dateRangeSchema = new Schema(
  {
    start: { type: Date, required: true },
    end: { type: Date, required: true },
  },
  { _id: false },
);

const propertySchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    address: {
      street: { type: String, required: true },
      postalCode: { type: String, required: true },
      city: { type: String, default: 'Paris' },
      arrondissement: { type: Number, required: true },
    },
    capacity: { type: Number, required: true },
    bedrooms: { type: Number, default: 1 },
    surfaceM2: { type: Number, required: true },
    amenities: { type: [String], default: [] },
    nightlyRateHtCents: { type: Number, required: true },
    vatRateBps: { type: Number, default: 1000 },
    photoIds: { type: [String], default: [] },
    blockedRanges: { type: [dateRangeSchema], default: [] },
    status: { type: String, enum: ['draft', 'pending', 'published', 'rejected'], default: 'pending' },
    rejectionReason: { type: String, default: null },
  },
  { timestamps: true },
);

propertySchema.index({ status: 1, 'address.arrondissement': 1 });

export const PropertyModel = model('Property', propertySchema);
