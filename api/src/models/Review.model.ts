import { Schema, model } from 'mongoose';

const reviewSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'ServiceBooking', required: true, unique: true },
    travelerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider', required: true },
    offeringId: { type: Schema.Types.ObjectId, ref: 'ServiceOffering', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
    moderation: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    moderationReason: { type: String, default: null },
    moderatedAt: { type: Date, default: null },
    authorName: { type: String, required: true },
  },
  { timestamps: true },
);

reviewSchema.index({ providerId: 1, moderation: 1 });
reviewSchema.index({ offeringId: 1, moderation: 1 });

export const ReviewModel = model('Review', reviewSchema);
