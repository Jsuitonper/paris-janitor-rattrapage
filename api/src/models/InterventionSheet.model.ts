import { Schema, model } from 'mongoose';

const reportSchema = new Schema(
  {
    performedAt: { type: Date, required: true },
    durationMinutes: { type: Number, required: true },
    workDone: { type: String, required: true },
    materialsUsed: { type: String, default: '' },
    incidents: { type: String, default: '' },
    attachmentIds: { type: [String], default: [] },
  },
  { _id: false },
);

const interventionSheetSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'ServiceBooking', required: true, unique: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider', required: true },
    travelerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['prefilled', 'completed'], default: 'prefilled' },
    prefill: {
      offeringName: { type: String, required: true },
      providerName: { type: String, required: true },
      travelerName: { type: String, required: true },
      address: { type: String, default: '' },
      scheduledAt: { type: Date, required: true },
      qty: { type: Number, required: true },
      unitLabel: { type: String, required: true },
    },
    report: { type: reportSchema, default: null },
    completedByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const InterventionSheetModel = model('InterventionSheet', interventionSheetSchema);
