import { Schema, model } from 'mongoose';

const stripeEventSchema = new Schema({
  _id: { type: String },
  type: { type: String, required: true },
  receivedAt: { type: Date, default: () => new Date() },
});

export const StripeEventModel = model('StripeEvent', stripeEventSchema);
