import { Schema, model } from 'mongoose';

const platformSettingsSchema = new Schema({
  _id: { type: String, default: 'default' },
  stayCommissionBps: { type: Number, default: 2000 },
  ownerYearlyFeeCents: { type: Number, default: 10000 },
  simulatorOptions: {
    type: [
      new Schema(
        {
          key: { type: String, required: true },
          label: { type: String, required: true },
          priceHtCents: { type: Number, required: true },
          frequency: { type: String, enum: ['per_stay', 'per_year'], required: true },
        },
        { _id: false },
      ),
    ],
    default: [],
  },
});

export const PlatformSettingsModel = model('PlatformSettings', platformSettingsSchema);
