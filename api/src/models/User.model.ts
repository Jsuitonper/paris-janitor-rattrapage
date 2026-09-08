import { Schema, model } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['traveler', 'admin'], required: true },
    profile: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      phone: { type: String },
    },
    stripeCustomerId: { type: String, default: null },
    vip: {
      tier: { type: String, enum: ['free', 'bagpacker', 'explorator'], default: 'free' },
      status: { type: String, enum: ['none', 'active', 'past_due', 'canceled'], default: 'none' },
      anchorAt: { type: Date, default: null },
      currentPeriodEnd: { type: Date, default: null },
      stripeSubscriptionId: { type: String, default: null },
      cancelAtPeriodEnd: { type: Boolean, default: false },
      interval: { type: String, enum: ['monthly', 'yearly'], default: null },
      renewalBonusApplied: { type: Boolean, default: false },
    },
    blocked: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const UserModel = model('User', userSchema);
