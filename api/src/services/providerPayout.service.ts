import * as invoiceRepository from '../repositories/invoice.repository';
import * as providerRepository from '../repositories/provider.repository';
import * as serviceBookingRepository from '../repositories/serviceBooking.repository';
import * as serviceOfferingRepository from '../repositories/serviceOffering.repository';
import type { ServiceBooking } from '../types/booking';
import type { Invoice, InvoiceLine, InvoicePeriod } from '../types/invoice';
import { AppError } from '../utils/AppError';
import { accumulate, archiveInvoiceDraft, emptyTotals, lineFromSnapshot, providerInvoiceNumber } from './invoice.service';

export function periodBounds(period: InvoicePeriod): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(period.year, period.month - 1, 1)),
    to: new Date(Date.UTC(period.month === 12 ? period.year + 1 : period.year, period.month % 12, 1)),
  };
}

async function linesForProvider(bookings: ServiceBooking[]): Promise<InvoiceLine[]> {
  const lines: InvoiceLine[] = [];
  for (const booking of bookings) {
    const offering = await serviceOfferingRepository.findOfferingById(booking.offeringId);
    lines.push(
      lineFromSnapshot({
        label: offering?.name ?? 'Prestation',
        bookingKind: 'service',
        bookingId: booking.id,
        performedAt: booking.scheduledAt,
        pricing: booking.pricing,
      }),
    );
  }
  return lines.sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime());
}

export async function generateProviderInvoices(period: InvoicePeriod): Promise<{ created: Invoice[]; skipped: string[] }> {
  if (period.month < 1 || period.month > 12) {
    throw new AppError(400, 'INVALID_PERIOD', 'Mois invalide');
  }
  const bookings = await serviceBookingRepository.listServiceBookings({
    status: 'completed',
    completedBetween: periodBounds(period),
  });

  const byProvider = new Map<string, ServiceBooking[]>();
  for (const booking of bookings) {
    const current = byProvider.get(booking.providerId) ?? [];
    current.push(booking);
    byProvider.set(booking.providerId, current);
  }

  const created: Invoice[] = [];
  const skipped: string[] = [];

  for (const [providerId, providerBookings] of byProvider) {
    const number = providerInvoiceNumber(period.year, period.month, providerId);
    if (await invoiceRepository.findInvoiceByNumber(number)) {
      skipped.push(number);
      continue;
    }
    const provider = await providerRepository.findProviderById(providerId);
    const lines = await linesForProvider(providerBookings);
    const issuedAt = new Date();
    const draft: Invoice = {
      id: invoiceRepository.newInvoiceId(),
      type: 'provider',
      number,
      travelerId: null,
      providerId,
      booking: null,
      period,
      party: {
        name: provider?.name ?? 'Prestataire',
        email: provider?.email ?? '',
        detail: provider?.job ?? '',
      },
      lines,
      totals: lines.reduce(accumulate, emptyTotals()),
      gridFsId: '',
      payoutStatus: 'pending',
      payoutAt: null,
      issuedAt,
    };
    try {
      created.push(await archiveInvoiceDraft(draft));
    } catch (error) {
      if (!invoiceRepository.isDuplicateKey(error)) throw error;
      skipped.push(number);
    }
  }

  return { created, skipped };
}

export async function setPayoutStatus(invoiceId: string, payoutStatus: 'pending' | 'sent'): Promise<Invoice> {
  const invoice = await invoiceRepository.findInvoiceById(invoiceId);
  if (!invoice) {
    throw new AppError(404, 'INVOICE_NOT_FOUND', 'Facture introuvable');
  }
  if (invoice.type !== 'provider') {
    throw new AppError(409, 'NOT_A_PROVIDER_INVOICE', 'Seule une facture prestataire porte un statut de virement');
  }
  return (await invoiceRepository.updatePayoutStatus(invoiceId, payoutStatus, payoutStatus === 'sent' ? new Date() : null))!;
}
