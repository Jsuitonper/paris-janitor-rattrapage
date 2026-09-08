import * as providerRepository from '../repositories/provider.repository';
import * as reviewRepository from '../repositories/review.repository';
import * as serviceBookingRepository from '../repositories/serviceBooking.repository';
import * as userRepository from '../repositories/user.repository';
import type { ModerationStatus, Review } from '../types/review';
import type { AuthUser } from '../types/user';
import { AppError } from '../utils/AppError';

export async function refreshProviderRating(providerId: string): Promise<void> {
  const { count, sum } = await reviewRepository.aggregateApprovedRating(providerId);
  await providerRepository.updateProviderRating(providerId, count, sum);
}

export async function submitReview(
  viewer: AuthUser,
  input: { bookingId: string; rating: number; comment: string },
): Promise<Review> {
  const booking = await serviceBookingRepository.findServiceBookingById(input.bookingId);
  if (!booking) {
    throw new AppError(404, 'BOOKING_NOT_FOUND', 'Réservation introuvable');
  }
  if (booking.travelerId !== viewer.id) {
    throw new AppError(403, 'FORBIDDEN', 'Cette réservation ne vous appartient pas');
  }
  if (booking.status !== 'completed') {
    throw new AppError(409, 'BOOKING_NOT_COMPLETED', 'La prestation doit être réalisée avant d’être évaluée');
  }
  const traveler = await userRepository.findUserById(viewer.id);
  const review = await reviewRepository.createReview({
    bookingId: booking.id,
    travelerId: viewer.id,
    providerId: booking.providerId,
    offeringId: booking.offeringId,
    rating: input.rating,
    comment: input.comment,
    authorName: traveler ? traveler.profile.firstName + ' ' + traveler.profile.lastName.charAt(0) + '.' : 'Voyageur',
  });
  if (!review) {
    throw new AppError(409, 'REVIEW_ALREADY_SUBMITTED', 'Cette prestation a déjà été évaluée');
  }
  return review;
}

export function findReviewForBooking(bookingId: string): Promise<Review | null> {
  return reviewRepository.findReviewByBooking(bookingId);
}

export function listMyReviews(viewer: AuthUser): Promise<Review[]> {
  return reviewRepository.listReviews({ travelerId: viewer.id });
}

export function listPublicReviews(filter: { providerId?: string; offeringId?: string }): Promise<Review[]> {
  return reviewRepository.listReviews({ ...filter, moderation: 'approved' });
}

export function listForModeration(moderation?: ModerationStatus): Promise<Review[]> {
  return reviewRepository.listReviews(moderation ? { moderation } : {});
}

export async function moderateReview(id: string, moderation: ModerationStatus, reason: string | null): Promise<Review> {
  const existing = await reviewRepository.findReviewById(id);
  if (!existing) {
    throw new AppError(404, 'REVIEW_NOT_FOUND', 'Avis introuvable');
  }
  const updated = (await reviewRepository.moderateReview(id, moderation, reason))!;
  await refreshProviderRating(updated.providerId);
  return updated;
}
