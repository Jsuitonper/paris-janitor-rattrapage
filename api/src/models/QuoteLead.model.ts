import { Schema, model } from 'mongoose';

const optionLineSchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    frequency: { type: String, enum: ['per_stay', 'per_year'], required: true },
    unitPriceHtCents: { type: Number, required: true },
    quantity: { type: Number, required: true },
    totalHtCents: { type: Number, required: true },
  },
  { _id: false },
);

const breakdownSchema = new Schema(
  {
    assumptions: {
      nightlyRateHtCents: { type: Number, required: true },
      occupancyRateBps: { type: Number, required: true },
      occupiedNights: { type: Number, required: true },
      averageStayNights: { type: Number, required: true },
      estimatedStays: { type: Number, required: true },
      commissionBps: { type: Number, required: true },
    },
    grossRevenueHtCents: { type: Number, required: true },
    charges: {
      platformCommissionHtCents: { type: Number, required: true },
      ownerYearlyFeeCents: { type: Number, required: true },
      options: { type: [optionLineSchema], default: [] },
      optionsHtCents: { type: Number, required: true },
      totalHtCents: { type: Number, required: true },
    },
    net: {
      yearlyHtCents: { type: Number, required: true },
      monthlyHtCents: { type: Number, required: true },
      perOccupiedNightHtCents: { type: Number, required: true },
    },
  },
  { _id: false },
);

const quoteLeadSchema = new Schema(
  {
    input: {
      arrondissement: { type: Number, required: true },
      surfaceM2: { type: Number, required: true },
      capacity: { type: Number, required: true },
      bedrooms: { type: Number, required: true },
      nightlyRateHtCents: { type: Number, required: true },
      occupancyRateBps: { type: Number, required: true },
      averageStayNights: { type: Number, required: true },
      optionKeys: { type: [String], default: [] },
    },
    breakdown: { type: breakdownSchema, required: true },
    contact: {
      type: new Schema(
        {
          firstName: { type: String, required: true },
          lastName: { type: String, required: true },
          email: { type: String, required: true },
          phone: { type: String, default: '' },
        },
        { _id: false },
      ),
      default: null,
    },
    status: { type: String, enum: ['new', 'contacted', 'converted', 'archived'], default: 'new' },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);

quoteLeadSchema.index({ status: 1, createdAt: -1 });

export const QuoteLeadModel = model('QuoteLead', quoteLeadSchema);
