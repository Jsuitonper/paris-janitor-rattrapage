import { Schema, model } from 'mongoose';

const messageThreadSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'ServiceBooking', required: true, unique: true },
    travelerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider', required: true },
    subject: { type: String, required: true },
    lastMessageAt: { type: Date, default: null },
    unreadForAdmin: { type: Number, default: 0 },
    unreadForTraveler: { type: Number, default: 0 },
  },
  { timestamps: true },
);

messageThreadSchema.index({ lastMessageAt: -1 });

export const MessageThreadModel = model('MessageThread', messageThreadSchema);
