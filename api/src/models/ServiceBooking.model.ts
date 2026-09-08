import { Schema, model } from 'mongoose';
import { pricingSnapshotSchema } from './pricingSnapshot.schema';

const serviceBookingSchema = new Schema(
  {
    travelerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    offeringId: { type: Schema.Types.ObjectId, ref: 'ServiceOffering', required: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider', required: true },
    stayBookingId: { type: Schema.Types.ObjectId, ref: 'StayBooking', default: null },
    qty: { type: Number, required: true },
    scheduledAt: { type: Date, required: true },
    notes: { type: String, default: '' },
    status: { type: String, enum: ['requested', 'confirmed', 'completed', 'cancelled'], default: 'requested' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'payment_failed'], default: 'pending' },
    pricing: { type: pricingSnapshotSchema, required: true },
  },
  { timestamps: true },
);

serviceBookingSchema.index({ travelerId: 1, createdAt: -1 });
serviceBookingSchema.index({ providerId: 1, status: 1, scheduledAt: 1 });

export const ServiceBookingModel = model('ServiceBooking', serviceBookingSchema);
