import * as counterRepository from '../repositories/counter.repository';
import * as gridfsRepository from '../repositories/gridfs.repository';
import * as invoiceRepository from '../repositories/invoice.repository';
import * as propertyRepository from '../repositories/property.repository';
import * as serviceBookingRepository from '../repositories/serviceBooking.repository';
import * as serviceOfferingRepository from '../repositories/serviceOffering.repository';
import * as stayBookingRepository from '../repositories/stayBooking.repository';
import * as userRepository from '../repositories/user.repository';
import type { ServiceBooking, StayBooking } from '../types/booking';
import type { Invoice, InvoiceLine, InvoiceTotals } from '../types/invoice';
import type { BookingKind } from '../types/payment';
import type { PricingSnapshot } from '../types/pricing';
import type { AuthUser } from '../types/user';
import { AppError } from '../utils/AppError';
import { storeFile } from './file.service';
import { renderInvoicePdf } from './invoicePdf';

const UNIT_LABELS: Record<string, string> = {
  fixed: 'forfait',
  km: 'km',
  hour: 'heure(s)',
  m2: 'm²',
  item: 'unité(s)',
  night: 'nuit(s)',
};

export function emptyTotals(): InvoiceTotals {
  return {
    grossHtCents: 0,
    discountHtCents: 0,
    netHtCents: 0,
    commissionHtCents: 0,
    providerNetHtCents: 0,
    vatCents: 0,
    totalTtcCents: 0,
  };
}

export function accumulate(totals: InvoiceTotals, line: InvoiceLine): InvoiceTotals {
  return {
    grossHtCents: totals.grossHtCents + line.grossHtCents,
    discountHtCents: totals.discountHtCents + line.discountHtCents,
    netHtCents: totals.netHtCents + line.netHtCents,
    commissionHtCents: totals.commissionHtCents + line.commissionHtCents,
    providerNetHtCents: totals.providerNetHtCents + line.providerNetHtCents,
    vatCents: totals.vatCents + line.vatCents,
    totalTtcCents: totals.totalTtcCents + line.totalTtcCents,
  };
}

export function lineFromSnapshot(input: {
  label: string;
  bookingKind: BookingKind;
  bookingId: string;
  performedAt: Date;
  pricing: PricingSnapshot;
}): InvoiceLine {
  const p = input.pricing;
  return {
    label: input.label,
    qty: p.qty,
    unitLabel: UNIT_LABELS[p.unit] ?? p.unit,
    bookingKind: input.bookingKind,
    bookingId: input.bookingId,
    performedAt: input.performedAt,
    grossHtCents: p.grossHtCents,
    discountHtCents: p.discountHtCents,
    netHtCents: p.travelerPaysHtCents,
    commissionBps: p.commissionBps,
    commissionHtCents: p.commissionHtCents,
    providerNetHtCents: p.providerNetHtCents,
    vatRateBps: p.vatRateBps,
    vatCents: p.vatCents,
    totalTtcCents: p.totalTtcCents,
  };
}

export async function nextTravelerNumber(issuedAt: Date): Promise<string> {
  const year = issuedAt.getUTCFullYear();
  const seq = await counterRepository.nextSequence('invoice_traveler_' + year);
  return 'FV-' + year + '-' + seq.toString().padStart(6, '0');
}

export function providerInvoiceNumber(year: number, month: number, providerId: string): string {
  return 'FP-' + year + '-' + month.toString().padStart(2, '0') + '-' + providerId;
}

async function archive(draft: Invoice): Promise<Invoice> {
  const pdf = await renderInvoicePdf(draft);
  const stored = await storeFile({
    kind: 'invoice',
    originalName: draft.number + '.pdf',
    contentType: 'application/pdf',
    content: pdf,
    ownerUserId: draft.travelerId,
    invoiceId: draft.id,
  });
  try {
    return await invoiceRepository.createInvoice({ ...draft, gridFsId: stored.id });
  } catch (error) {
    await gridfsRepository.deleteFile(stored.id);
    throw error;
  }
}

async function labelForStay(booking: StayBooking): Promise<string> {
  const property = await propertyRepository.findPropertyById(booking.propertyId);
  return 'Séjour — ' + (property?.title ?? 'logement') + ' (' + booking.nights + ' nuit(s))';
}

async function labelForService(booking: ServiceBooking): Promise<string> {
  const offering = await serviceOfferingRepository.findOfferingById(booking.offeringId);
  return 'Prestation — ' + (offering?.name ?? 'service');
}

export async function emitTravelerInvoice(kind: BookingKind, bookingId: string): Promise<Invoice> {
  const existing = await invoiceRepository.findInvoiceByBooking(kind, bookingId);
  if (existing) return existing;

  const booking =
    kind === 'stay'
      ? await stayBookingRepository.findStayBookingById(bookingId)
      : await serviceBookingRepository.findServiceBookingById(bookingId);
  if (!booking) {
    throw new AppError(404, 'BOOKING_NOT_FOUND', 'Réservation introuvable');
  }

  const traveler = await userRepository.findUserById(booking.travelerId);
  const line = lineFromSnapshot({
    label: kind === 'stay' ? await labelForStay(booking as StayBooking) : await labelForService(booking as ServiceBooking),
    bookingKind: kind,
    bookingId,
    performedAt: kind === 'stay' ? (booking as StayBooking).startDate : (booking as ServiceBooking).scheduledAt,
    pricing: booking.pricing,
  });

  const issuedAt = new Date();
  const draft: Invoice = {
    id: invoiceRepository.newInvoiceId(),
    type: 'traveler',
    number: await nextTravelerNumber(issuedAt),
    travelerId: booking.travelerId,
    providerId: null,
    booking: { kind, id: bookingId },
    period: null,
    party: {
      name: traveler ? traveler.profile.firstName + ' ' + traveler.profile.lastName : 'Voyageur',
      email: traveler?.email ?? '',
      detail: '',
    },
    lines: [line],
    totals: accumulate(emptyTotals(), line),
    gridFsId: '',
    payoutStatus: 'not_applicable',
    payoutAt: null,
    issuedAt,
  };

  try {
    return await archive(draft);
  } catch (error) {
    if (invoiceRepository.isDuplicateKey(error)) {
      const concurrent = await invoiceRepository.findInvoiceByBooking(kind, bookingId);
      if (concurrent) return concurrent;
    }
    throw error;
  }
}

export async function emitTravelerInvoiceSafely(kind: BookingKind, bookingId: string): Promise<void> {
  try {
    await emitTravelerInvoice(kind, bookingId);
  } catch (error) {
    console.error('Émission de facture impossible pour ' + kind + ' ' + bookingId, error);
  }
}

export async function getInvoice(id: string, viewer: AuthUser): Promise<Invoice> {
  const invoice = await invoiceRepository.findInvoiceById(id);
  if (!invoice) {
    throw new AppError(404, 'INVOICE_NOT_FOUND', 'Facture introuvable');
  }
  if (viewer.role !== 'admin' && invoice.travelerId !== viewer.id) {
    throw new AppError(403, 'FORBIDDEN', 'Cette facture ne vous appartient pas');
  }
  return invoice;
}

export function listMyInvoices(viewer: AuthUser): Promise<Invoice[]> {
  return invoiceRepository.listInvoices({ travelerId: viewer.id });
}

export function listAllInvoices(type?: 'traveler' | 'provider'): Promise<Invoice[]> {
  return invoiceRepository.listInvoices(type ? { type } : {});
}

export { archive as archiveInvoiceDraft };
