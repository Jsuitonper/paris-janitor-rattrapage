import { Schema, model } from 'mongoose';
import { pricingSnapshotSchema } from './pricingSnapshot.schema';

const stayBookingSchema = new Schema(
  {
    travelerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    nights: { type: Number, required: true },
    guests: { type: Number, required: true },
    status: { type: String, enum: ['requested', 'confirmed', 'completed', 'cancelled'], default: 'requested' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'payment_failed'], default: 'pending' },
    pricing: { type: pricingSnapshotSchema, required: true },
  },
  { timestamps: true },
);

stayBookingSchema.index({ propertyId: 1, startDate: 1, endDate: 1 });
stayBookingSchema.index({ travelerId: 1, createdAt: -1 });

export const StayBookingModel = model('StayBooking', stayBookingSchema);
