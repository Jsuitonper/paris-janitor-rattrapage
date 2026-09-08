import { Types } from 'mongoose';
import { ReviewModel } from '../models/Review.model';
import type { ModerationStatus, Review } from '../types/review';

type ReviewDoc = Omit<Review, 'id' | 'bookingId' | 'travelerId' | 'providerId' | 'offeringId'> & {
  _id: Types.ObjectId;
  bookingId: Types.ObjectId;
  travelerId: Types.ObjectId;
  providerId: Types.ObjectId;
  offeringId: Types.ObjectId;
};

export type ReviewInput = {
  bookingId: string;
  travelerId: string;
  providerId: string;
  offeringId: string;
  rating: number;
  comment: string;
  authorName: string;
};

export type ReviewFilter = {
  moderation?: ModerationStatus;
  providerId?: string;
  offeringId?: string;
  travelerId?: string;
};

function toReview(doc: ReviewDoc): Review {
  return {
    id: doc._id.toString(),
    bookingId: doc.bookingId.toString(),
    travelerId: doc.travelerId.toString(),
    providerId: doc.providerId.toString(),
    offeringId: doc.offeringId.toString(),
    rating: doc.rating,
    comment: doc.comment ?? '',
    moderation: doc.moderation,
    moderationReason: doc.moderationReason ?? null,
    moderatedAt: doc.moderatedAt ?? null,
    authorName: doc.authorName,
    createdAt: doc.createdAt,
  };
}

export async function createReview(input: ReviewInput): Promise<Review | null> {
  try {
    const doc = await ReviewModel.create(input);
    return toReview(doc.toObject() as ReviewDoc);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 11000) return null;
    throw error;
  }
}

export async function findReviewById(id: string): Promise<Review | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  const doc = await ReviewModel.findById(id).lean<ReviewDoc>();
  return doc ? toReview(doc) : null;
}

export async function findReviewByBooking(bookingId: string): Promise<Review | null> {
  if (!Types.ObjectId.isValid(bookingId)) return null;
  const doc = await ReviewModel.findOne({ bookingId }).lean<ReviewDoc>();
  return doc ? toReview(doc) : null;
}

export async function listReviews(filter: ReviewFilter = {}): Promise<Review[]> {
  const docs = await ReviewModel.find(filter).sort({ createdAt: -1 }).lean<ReviewDoc[]>();
  return docs.map(toReview);
}

export async function moderateReview(
  id: string,
  moderation: ModerationStatus,
  moderationReason: string | null,
): Promise<Review | null> {
  const doc = await ReviewModel.findByIdAndUpdate(
    id,
    { $set: { moderation, moderationReason, moderatedAt: new Date() } },
    { returnDocument: 'after' },
  ).lean<ReviewDoc>();
  return doc ? toReview(doc) : null;
}

export async function aggregateApprovedRating(providerId: string): Promise<{ count: number; sum: number }> {
  const docs = await ReviewModel.find({ providerId, moderation: 'approved' }).select('rating').lean<{ rating: number }[]>();
  return { count: docs.length, sum: docs.reduce((total, doc) => total + doc.rating, 0) };
}
