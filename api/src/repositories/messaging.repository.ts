import { Types } from 'mongoose';
import { MessageModel } from '../models/Message.model';
import { MessageThreadModel } from '../models/MessageThread.model';
import type { Message, MessageAuthorRole, MessageThread } from '../types/messaging';

type ThreadDoc = Omit<MessageThread, 'id' | 'bookingId' | 'travelerId' | 'providerId'> & {
  _id: Types.ObjectId;
  bookingId: Types.ObjectId;
  travelerId: Types.ObjectId;
  providerId: Types.ObjectId;
};

type MessageDoc = Omit<Message, 'id' | 'threadId' | 'authorUserId'> & {
  _id: Types.ObjectId;
  threadId: Types.ObjectId;
  authorUserId: Types.ObjectId;
};

function toThread(doc: ThreadDoc): MessageThread {
  return {
    id: doc._id.toString(),
    bookingId: doc.bookingId.toString(),
    travelerId: doc.travelerId.toString(),
    providerId: doc.providerId.toString(),
    subject: doc.subject,
    lastMessageAt: doc.lastMessageAt ?? null,
    unreadForAdmin: doc.unreadForAdmin,
    unreadForTraveler: doc.unreadForTraveler,
    createdAt: doc.createdAt,
  };
}

function toMessage(doc: MessageDoc): Message {
  return {
    id: doc._id.toString(),
    threadId: doc.threadId.toString(),
    authorRole: doc.authorRole,
    authorUserId: doc.authorUserId.toString(),
    authorName: doc.authorName,
    body: doc.body,
    createdAt: doc.createdAt,
  };
}

export async function findThreadByBooking(bookingId: string): Promise<MessageThread | null> {
  if (!Types.ObjectId.isValid(bookingId)) return null;
  const doc = await MessageThreadModel.findOne({ bookingId }).lean<ThreadDoc>();
  return doc ? toThread(doc) : null;
}

export async function findThreadById(id: string): Promise<MessageThread | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  const doc = await MessageThreadModel.findById(id).lean<ThreadDoc>();
  return doc ? toThread(doc) : null;
}

export async function upsertThread(input: {
  bookingId: string;
  travelerId: string;
  providerId: string;
  subject: string;
}): Promise<MessageThread> {
  const doc = await MessageThreadModel.findOneAndUpdate(
    { bookingId: input.bookingId },
    { $setOnInsert: input },
    { upsert: true, returnDocument: 'after' },
  ).lean<ThreadDoc>();
  return toThread(doc!);
}

export async function listThreads(filter: { travelerId?: string } = {}): Promise<MessageThread[]> {
  const docs = await MessageThreadModel.find(filter).sort({ lastMessageAt: -1, createdAt: -1 }).lean<ThreadDoc[]>();
  return docs.map(toThread);
}

export async function appendMessage(input: {
  threadId: string;
  authorRole: MessageAuthorRole;
  authorUserId: string;
  authorName: string;
  body: string;
}): Promise<Message> {
  const doc = await MessageModel.create(input);
  const unread = input.authorRole === 'traveler' ? { unreadForAdmin: 1 } : { unreadForTraveler: 1 };
  await MessageThreadModel.findByIdAndUpdate(input.threadId, {
    $set: { lastMessageAt: new Date() },
    $inc: unread,
  });
  return toMessage(doc.toObject() as MessageDoc);
}

export async function listMessages(threadId: string): Promise<Message[]> {
  const docs = await MessageModel.find({ threadId }).sort({ createdAt: 1 }).lean<MessageDoc[]>();
  return docs.map(toMessage);
}

export async function markThreadRead(threadId: string, reader: 'admin' | 'traveler'): Promise<void> {
  const patch = reader === 'admin' ? { unreadForAdmin: 0 } : { unreadForTraveler: 0 };
  await MessageThreadModel.findByIdAndUpdate(threadId, { $set: patch });
}
