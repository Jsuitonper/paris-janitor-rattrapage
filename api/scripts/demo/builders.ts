import * as invoiceRepository from '../../src/repositories/invoice.repository';
import * as messagingRepository from '../../src/repositories/messaging.repository';
import * as providerRepository from '../../src/repositories/provider.repository';
import * as quoteLeadRepository from '../../src/repositories/quoteLead.repository';
import * as reviewRepository from '../../src/repositories/review.repository';
import * as serviceBookingRepository from '../../src/repositories/serviceBooking.repository';
import * as stayBookingRepository from '../../src/repositories/stayBooking.repository';
import * as userRepository from '../../src/repositories/user.repository';
import * as bookingService from '../../src/services/booking.service';
import * as interventionSheetService from '../../src/services/interventionSheet.service';
import * as invoiceService from '../../src/services/invoice.service';
import * as reviewService from '../../src/services/review.service';
import type { ServiceBooking, StayBooking } from '../../src/types/booking';
import type { ModerationStatus } from '../../src/types/review';
import type { AuthUser } from '../../src/types/user';

export const ADMIN_VIEWER: AuthUser = { id: '', role: 'admin' };

export function configureAdmin(adminId: string): void {
  ADMIN_VIEWER.id = adminId;
}

export function viewerFor(userId: string): AuthUser {
  return { id: userId, role: 'traveler' };
}

export async function createStay(
  travelerId: string,
  request: { propertyId: string; startDate: string; endDate: string; guests: number },
  outcome: 'requested' | 'confirmed' | 'paid-completed',
): Promise<StayBooking> {
  const viewer = viewerFor(travelerId);
  const booking = await bookingService.createStayBooking(viewer, request);
  if (outcome === 'requested') return booking;

  await bookingService.setStayStatus(booking.id, 'confirmed', ADMIN_VIEWER);
  if (outcome === 'confirmed') {
    return (await stayBookingRepository.findStayBookingById(booking.id))!;
  }

  await stayBookingRepository.updateStayBooking(booking.id, { paymentStatus: 'paid' });
  await invoiceService.emitTravelerInvoice('stay', booking.id);
  await bookingService.setStayStatus(booking.id, 'completed', ADMIN_VIEWER);
  return (await stayBookingRepository.findStayBookingById(booking.id))!;
}

export type ServiceOutcome = 'requested' | 'confirmed' | 'completed';

export async function createService(
  travelerId: string,
  request: { offeringId: string; qty: number; scheduledAt: Date; stayBookingId?: string; notes?: string },
  outcome: ServiceOutcome,
  report?: { performedAt: Date; durationMinutes: number; workDone: string; materialsUsed?: string; incidents?: string },
): Promise<ServiceBooking> {
  const viewer = viewerFor(travelerId);
  const booking = await bookingService.createServiceBooking(viewer, request);
  if (outcome === 'requested') return booking;

  await bookingService.setServiceStatus(booking.id, 'confirmed', ADMIN_VIEWER);
  if (outcome === 'confirmed') {
    return (await serviceBookingRepository.findServiceBookingById(booking.id))!;
  }

  const sheet = await interventionSheetService.findForBooking(booking.id);
  if (!sheet) {
    throw new Error('Fiche d’intervention absente pour la réservation ' + booking.id);
  }
  await interventionSheetService.completeSheet(
    sheet.id,
    {
      performedAt: report?.performedAt ?? request.scheduledAt,
      durationMinutes: report?.durationMinutes ?? 60,
      workDone: report?.workDone ?? 'Prestation réalisée conformément à la demande.',
      materialsUsed: report?.materialsUsed ?? '',
      incidents: report?.incidents ?? 'Aucun',
      attachmentIds: [],
    },
    ADMIN_VIEWER.id,
  );

  if (booking.pricing.totalTtcCents > 0) {
    await serviceBookingRepository.updateServiceBooking(booking.id, { paymentStatus: 'paid' });
    await invoiceService.emitTravelerInvoice('service', booking.id);
  }
  await bookingService.setServiceStatus(booking.id, 'completed', ADMIN_VIEWER);
  return (await serviceBookingRepository.findServiceBookingById(booking.id))!;
}

export async function addReview(
  booking: ServiceBooking,
  rating: number,
  comment: string,
  moderation: ModerationStatus,
  moderationReason: string | null = null,
): Promise<void> {
  const traveler = await userRepository.findUserById(booking.travelerId);
  const created = await reviewRepository.createReview({
    bookingId: booking.id,
    travelerId: booking.travelerId,
    providerId: booking.providerId,
    offeringId: booking.offeringId,
    rating,
    comment,
    authorName: traveler ? traveler.profile.firstName + ' ' + traveler.profile.lastName.charAt(0) + '.' : 'Voyageur',
  });
  if (!created) return;
  if (moderation !== 'pending') {
    await reviewRepository.moderateReview(created.id, moderation, moderationReason);
    await reviewService.refreshProviderRating(booking.providerId);
  }
}

export async function addConversation(
  booking: ServiceBooking,
  subject: string,
  exchanges: { role: 'traveler' | 'concierge'; body: string }[],
): Promise<void> {
  const traveler = await userRepository.findUserById(booking.travelerId);
  const thread = await messagingRepository.upsertThread({
    bookingId: booking.id,
    travelerId: booking.travelerId,
    providerId: booking.providerId,
    subject,
  });
  for (const exchange of exchanges) {
    await messagingRepository.appendMessage({
      threadId: thread.id,
      authorRole: exchange.role,
      authorUserId: booking.travelerId,
      authorName:
        exchange.role === 'concierge'
          ? 'Conciergerie Paris Janitor'
          : traveler
            ? traveler.profile.firstName + ' ' + traveler.profile.lastName
            : 'Voyageur',
      body: exchange.body,
    });
  }
}

export async function addLead(
  lead: Parameters<typeof quoteLeadRepository.createLead>[0],
  contact: { firstName: string; lastName: string; email: string; phone: string } | null,
  status: 'new' | 'contacted' | 'converted' | 'archived',
  notes: string,
): Promise<void> {
  const created = await quoteLeadRepository.createLead(lead);
  if (contact || status !== 'new' || notes) {
    await quoteLeadRepository.updateLead(created.id, {
      ...(contact ? { contact } : {}),
      status,
      notes,
    });
  }
}

export async function providerRatings(): Promise<string[]> {
  const providers = await providerRepository.listProviders();
  return providers
    .filter((provider) => provider.ratingCount > 0)
    .map((provider) => provider.name + ' : ' + (provider.ratingSum / provider.ratingCount).toFixed(1) + '/5 sur ' + provider.ratingCount + ' avis');
}

export async function invoiceSummary(): Promise<string> {
  const invoices = await invoiceRepository.listInvoices();
  const travelers = invoices.filter((invoice) => invoice.type === 'traveler').length;
  const providers = invoices.filter((invoice) => invoice.type === 'provider').length;
  return travelers + ' facture(s) voyageur, ' + providers + ' facture(s) prestataire';
}
