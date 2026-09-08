import * as messagingRepository from '../repositories/messaging.repository';
import * as serviceBookingRepository from '../repositories/serviceBooking.repository';
import * as serviceOfferingRepository from '../repositories/serviceOffering.repository';
import * as userRepository from '../repositories/user.repository';
import type { Message, MessageThread } from '../types/messaging';
import type { AuthUser } from '../types/user';
import { AppError } from '../utils/AppError';

const CONCIERGE_NAME = 'Conciergerie Paris Janitor';

async function requireOwnedBooking(bookingId: string, viewer: AuthUser) {
  const booking = await serviceBookingRepository.findServiceBookingById(bookingId);
  if (!booking) {
    throw new AppError(404, 'BOOKING_NOT_FOUND', 'Réservation introuvable');
  }
  if (viewer.role !== 'admin' && booking.travelerId !== viewer.id) {
    throw new AppError(403, 'FORBIDDEN', 'Cette réservation ne vous appartient pas');
  }
  return booking;
}

export async function openThread(bookingId: string, viewer: AuthUser): Promise<MessageThread> {
  const booking = await requireOwnedBooking(bookingId, viewer);
  if (booking.status === 'cancelled') {
    throw new AppError(409, 'BOOKING_CANCELLED', 'Cette réservation est annulée');
  }
  const offering = await serviceOfferingRepository.findOfferingById(booking.offeringId);
  return messagingRepository.upsertThread({
    bookingId: booking.id,
    travelerId: booking.travelerId,
    providerId: booking.providerId,
    subject: offering?.name ?? 'Prestation',
  });
}

export async function getConversation(
  bookingId: string,
  viewer: AuthUser,
): Promise<{ thread: MessageThread; messages: Message[] }> {
  await requireOwnedBooking(bookingId, viewer);
  const thread = await messagingRepository.findThreadByBooking(bookingId);
  if (!thread) {
    return { thread: await openThread(bookingId, viewer), messages: [] };
  }
  await messagingRepository.markThreadRead(thread.id, viewer.role === 'admin' ? 'admin' : 'traveler');
  return { thread, messages: await messagingRepository.listMessages(thread.id) };
}

export async function postMessage(bookingId: string, viewer: AuthUser, body: string): Promise<Message> {
  const thread = await openThread(bookingId, viewer);
  const isAdmin = viewer.role === 'admin';
  const author = isAdmin ? null : await userRepository.findUserById(viewer.id);
  return messagingRepository.appendMessage({
    threadId: thread.id,
    authorRole: isAdmin ? 'concierge' : 'traveler',
    authorUserId: viewer.id,
    authorName: isAdmin ? CONCIERGE_NAME : author ? author.profile.firstName + ' ' + author.profile.lastName : 'Voyageur',
    body,
  });
}

export function listMyThreads(viewer: AuthUser): Promise<MessageThread[]> {
  return messagingRepository.listThreads({ travelerId: viewer.id });
}

export function listAllThreads(): Promise<MessageThread[]> {
  return messagingRepository.listThreads();
}
