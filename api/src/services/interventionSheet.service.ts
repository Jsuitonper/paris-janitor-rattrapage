import * as sheetRepository from '../repositories/interventionSheet.repository';
import * as propertyRepository from '../repositories/property.repository';
import * as providerRepository from '../repositories/provider.repository';
import * as serviceBookingRepository from '../repositories/serviceBooking.repository';
import * as serviceOfferingRepository from '../repositories/serviceOffering.repository';
import * as stayBookingRepository from '../repositories/stayBooking.repository';
import * as userRepository from '../repositories/user.repository';
import type { ServiceBooking } from '../types/booking';
import type { InterventionReport, InterventionSheet } from '../types/intervention';
import type { AuthUser } from '../types/user';
import { AppError } from '../utils/AppError';

const UNIT_LABELS: Record<string, string> = {
  fixed: 'forfait',
  km: 'km',
  hour: 'heure(s)',
  m2: 'm²',
  item: 'unité(s)',
  night: 'nuit(s)',
};

async function addressFor(booking: ServiceBooking): Promise<string> {
  if (!booking.stayBookingId) return '';
  const stay = await stayBookingRepository.findStayBookingById(booking.stayBookingId);
  if (!stay) return '';
  const property = await propertyRepository.findPropertyById(stay.propertyId);
  if (!property) return '';
  return property.address.street + ', ' + property.address.postalCode + ' ' + property.address.city;
}

export async function createForBooking(booking: ServiceBooking): Promise<InterventionSheet | null> {
  const existing = await sheetRepository.findSheetByBooking(booking.id);
  if (existing) return existing;

  const [offering, provider, traveler, address] = await Promise.all([
    serviceOfferingRepository.findOfferingById(booking.offeringId),
    providerRepository.findProviderById(booking.providerId),
    userRepository.findUserById(booking.travelerId),
    addressFor(booking),
  ]);

  return sheetRepository.createSheet({
    bookingId: booking.id,
    providerId: booking.providerId,
    travelerId: booking.travelerId,
    prefill: {
      offeringName: offering?.name ?? 'Prestation',
      providerName: provider?.name ?? 'Prestataire',
      travelerName: traveler ? traveler.profile.firstName + ' ' + traveler.profile.lastName : 'Voyageur',
      address,
      scheduledAt: booking.scheduledAt,
      qty: booking.pricing.qty,
      unitLabel: UNIT_LABELS[booking.pricing.unit] ?? booking.pricing.unit,
    },
  });
}

export function findForBooking(bookingId: string): Promise<InterventionSheet | null> {
  return sheetRepository.findSheetByBooking(bookingId);
}

export async function getForViewer(bookingId: string, viewer: AuthUser): Promise<InterventionSheet> {
  const booking = await serviceBookingRepository.findServiceBookingById(bookingId);
  if (!booking) {
    throw new AppError(404, 'BOOKING_NOT_FOUND', 'Réservation introuvable');
  }
  if (viewer.role !== 'admin' && booking.travelerId !== viewer.id) {
    throw new AppError(403, 'FORBIDDEN', 'Cette réservation ne vous appartient pas');
  }
  const sheet = await sheetRepository.findSheetByBooking(bookingId);
  if (!sheet) {
    throw new AppError(404, 'SHEET_NOT_FOUND', 'Aucune fiche d’intervention pour cette réservation');
  }
  if (viewer.role !== 'admin' && sheet.status !== 'completed') {
    throw new AppError(404, 'SHEET_NOT_AVAILABLE', 'La fiche d’intervention n’est pas encore disponible');
  }
  return sheet;
}

export function listSheets(status?: 'prefilled' | 'completed'): Promise<InterventionSheet[]> {
  return sheetRepository.listSheets(status ? { status } : {});
}

export async function completeSheet(sheetId: string, report: InterventionReport, adminId: string): Promise<InterventionSheet> {
  const sheet = await sheetRepository.findSheetById(sheetId);
  if (!sheet) {
    throw new AppError(404, 'SHEET_NOT_FOUND', 'Fiche d’intervention introuvable');
  }
  return (await sheetRepository.completeSheet(sheetId, report, adminId))!;
}

export async function assertCompletedForBooking(bookingId: string): Promise<void> {
  const sheet = await sheetRepository.findSheetByBooking(bookingId);
  if (!sheet || sheet.status !== 'completed') {
    throw new AppError(409, 'SHEET_REQUIRED', 'La fiche d’intervention doit être complétée avant de clore la prestation');
  }
}

export function removeForBooking(bookingId: string): Promise<void> {
  return sheetRepository.deleteSheetForBooking(bookingId);
}
