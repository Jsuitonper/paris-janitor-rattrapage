import { Schema, model } from 'mongoose';

const paymentSchema = new Schema(
  {
    paymentIntentId: { type: String, required: true, unique: true },
    bookingKind: { type: String, enum: ['stay', 'service'], required: true },
    bookingId: { type: Schema.Types.ObjectId, required: true },
    travelerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amountCents: { type: Number, required: true },
    currency: { type: String, default: 'eur' },
    status: {
      type: String,
      enum: ['requires_payment_method', 'processing', 'succeeded', 'failed', 'amount_mismatch'],
      required: true,
    },
    lastError: { type: String, default: null },
  },
  { timestamps: true },
);

paymentSchema.index({ bookingKind: 1, bookingId: 1, createdAt: -1 });
paymentSchema.index({ travelerId: 1, createdAt: -1 });

export const PaymentModel = model('Payment', paymentSchema);
