import * as serviceBookingRepository from '../repositories/serviceBooking.repository';
import * as stayBookingRepository from '../repositories/stayBooking.repository';
import * as vipQuotaUsageRepository from '../repositories/vipQuotaUsage.repository';
import type { BookingStatus, ServiceBooking, StayBooking } from '../types/booking';
import type { AuthUser } from '../types/user';
import { AppError } from '../utils/AppError';
import { assertCompletedForBooking, createForBooking, removeForBooking } from './interventionSheet.service';
import { emitTravelerInvoiceSafely } from './invoice.service';
import { prepareService, prepareStay, type ServiceRequest, type StayRequest } from './quote.service';

const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  requested: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!TRANSITIONS[from].includes(to)) {
    throw new AppError(409, 'INVALID_TRANSITION', 'Passage de ' + from + ' à ' + to + ' impossible');
  }
}

function assertOwner(booking: { travelerId: string }, viewer: AuthUser): void {
  if (viewer.role !== 'admin' && booking.travelerId !== viewer.id) {
    throw new AppError(403, 'FORBIDDEN', 'Cette réservation ne vous appartient pas');
  }
}

export async function createStayBooking(viewer: AuthUser, request: StayRequest): Promise<StayBooking> {
  const prepared = await prepareStay(request);
  return stayBookingRepository.createStayBooking({
    travelerId: viewer.id,
    propertyId: prepared.property.id,
    startDate: prepared.startDate,
    endDate: prepared.endDate,
    nights: prepared.nights,
    guests: request.guests,
    pricing: prepared.pricing,
  });
}

export async function createServiceBooking(viewer: AuthUser, request: ServiceRequest): Promise<ServiceBooking> {
  const prepared = await prepareService(viewer, request);
  const booking = await serviceBookingRepository.createServiceBooking({
    travelerId: viewer.id,
    offeringId: prepared.offering.id,
    providerId: prepared.offering.providerId,
    stayBookingId: request.stayBookingId ?? null,
    qty: request.qty,
    scheduledAt: request.scheduledAt,
    notes: request.notes ?? '',
    paymentStatus: prepared.pricing.totalTtcCents === 0 ? 'paid' : 'pending',
    pricing: prepared.pricing,
  });
  if (prepared.pricing.freeQuotaUsed) {
    const reserved = await vipQuotaUsageRepository.reserveQuota({
      userId: viewer.id,
      windowMonths: prepared.plan.freeQuota!.windowMonths,
      windowIndex: prepared.pricing.quotaWindowIndex!,
      serviceBookingId: booking.id,
    });
    if (!reserved) {
      await serviceBookingRepository.deleteServiceBooking(booking.id);
      throw new AppError(409, 'QUOTA_ALREADY_USED', 'La prestation offerte de cette période a déjà été utilisée');
    }
  }
  if (booking.paymentStatus === 'paid') {
    await emitTravelerInvoiceSafely('service', booking.id);
  }
  return booking;
}

export async function getStayBooking(id: string, viewer: AuthUser): Promise<StayBooking> {
  const booking = await stayBookingRepository.findStayBookingById(id);
  if (!booking) {
    throw new AppError(404, 'BOOKING_NOT_FOUND', 'Réservation introuvable');
  }
  assertOwner(booking, viewer);
  return booking;
}

export async function getServiceBooking(id: string, viewer: AuthUser): Promise<ServiceBooking> {
  const booking = await serviceBookingRepository.findServiceBookingById(id);
  if (!booking) {
    throw new AppError(404, 'BOOKING_NOT_FOUND', 'Réservation introuvable');
  }
  assertOwner(booking, viewer);
  return booking;
}

export async function listMyBookings(viewer: AuthUser): Promise<{ stays: StayBooking[]; services: ServiceBooking[] }> {
  const [stays, services] = await Promise.all([
    stayBookingRepository.listStayBookings({ travelerId: viewer.id }),
    serviceBookingRepository.listServiceBookings({ travelerId: viewer.id }),
  ]);
  return { stays, services };
}

export function listAllStayBookings(status?: BookingStatus): Promise<StayBooking[]> {
  return stayBookingRepository.listStayBookings(status ? { status } : {});
}

export function listAllServiceBookings(status?: BookingStatus): Promise<ServiceBooking[]> {
  return serviceBookingRepository.listServiceBookings(status ? { status } : {});
}

export async function setStayStatus(id: string, status: BookingStatus, viewer: AuthUser): Promise<StayBooking> {
  const booking = await getStayBooking(id, viewer);
  assertTransition(booking.status, status);
  return (await stayBookingRepository.updateStayBooking(id, { status }))!;
}

export async function setServiceStatus(id: string, status: BookingStatus, viewer: AuthUser): Promise<ServiceBooking> {
  const booking = await getServiceBooking(id, viewer);
  assertTransition(booking.status, status);
  if (status === 'completed') {
    await assertCompletedForBooking(id);
  }
  if (status === 'cancelled') {
    await vipQuotaUsageRepository.releaseQuotaForBooking(id);
    await removeForBooking(id);
  }
  const updated = (await serviceBookingRepository.updateServiceBooking(id, { status }))!;
  if (status === 'confirmed') {
    await createForBooking(updated);
  }
  return updated;
}

export function cancelStayBooking(id: string, viewer: AuthUser): Promise<StayBooking> {
  return setStayStatus(id, 'cancelled', viewer);
}

export function cancelServiceBooking(id: string, viewer: AuthUser): Promise<ServiceBooking> {
  return setServiceStatus(id, 'cancelled', viewer);
}
