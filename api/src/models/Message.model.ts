import { Schema, model } from 'mongoose';

const messageSchema = new Schema(
  {
    threadId: { type: Schema.Types.ObjectId, ref: 'MessageThread', required: true },
    authorRole: { type: String, enum: ['traveler', 'concierge'], required: true },
    authorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true },
    body: { type: String, required: true },
  },
  { timestamps: true },
);

messageSchema.index({ threadId: 1, createdAt: 1 });

export const MessageModel = model('Message', messageSchema);
