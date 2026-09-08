import type Stripe from 'stripe';
import { env } from '../config/env';
import { requireStripe } from '../config/stripe';
import * as paymentRepository from '../repositories/payment.repository';
import * as serviceBookingRepository from '../repositories/serviceBooking.repository';
import * as stayBookingRepository from '../repositories/stayBooking.repository';
import * as userRepository from '../repositories/user.repository';
import * as vipQuotaUsageRepository from '../repositories/vipQuotaUsage.repository';
import type { PaymentStatus, ServiceBooking, StayBooking } from '../types/booking';
import type { BookingKind, Payment } from '../types/payment';
import type { AuthUser } from '../types/user';
import { AppError } from '../utils/AppError';
import { getServiceBooking, getStayBooking } from './booking.service';
import { emitTravelerInvoiceSafely } from './invoice.service';
import { ensureCustomerId } from './subscription.service';

type BookingRef = { kind: BookingKind; bookingId: string; userId: string };

const PAYABLE_INTENT_STATUSES = ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'];

export function getPaymentConfig(): { publishableKey: string } {
  if (!env.STRIPE_PUBLISHABLE_KEY) {
    throw new AppError(503, 'STRIPE_NOT_CONFIGURED', 'Clé publiable Stripe absente');
  }
  return { publishableKey: env.STRIPE_PUBLISHABLE_KEY };
}

export async function createPaymentIntent(
  viewer: AuthUser,
  kind: BookingKind,
  bookingId: string,
): Promise<{ clientSecret: string; paymentIntentId: string; amountCents: number }> {
  const booking = kind === 'stay' ? await getStayBooking(bookingId, viewer) : await getServiceBooking(bookingId, viewer);
  if (booking.status === 'cancelled') {
    throw new AppError(409, 'BOOKING_CANCELLED', 'Cette réservation est annulée');
  }
  const amountCents = booking.pricing.totalTtcCents;
  if (amountCents === 0) {
    throw new AppError(409, 'NOTHING_TO_PAY', 'Aucun montant à régler pour cette réservation');
  }
  if (booking.paymentStatus === 'paid') {
    throw new AppError(409, 'ALREADY_PAID', 'Cette réservation est déjà payée');
  }
  const stripe = requireStripe();
  const existing = await paymentRepository.findLatestPaymentForBooking(kind, bookingId);
  if (existing && existing.status !== 'succeeded' && existing.status !== 'amount_mismatch') {
    const intent = await stripe.paymentIntents.retrieve(existing.paymentIntentId);
    if (PAYABLE_INTENT_STATUSES.includes(intent.status) && intent.amount === amountCents && intent.client_secret) {
      return { clientSecret: intent.client_secret, paymentIntentId: intent.id, amountCents };
    }
  }
  const user = await userRepository.findUserById(viewer.id);
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'Utilisateur introuvable');
  }
  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'eur',
    customer: await ensureCustomerId(user),
    automatic_payment_methods: { enabled: true },
    description: 'Paris Janitor — ' + (kind === 'stay' ? 'séjour ' : 'prestation ') + bookingId,
    metadata: { bookingKind: kind, bookingId, userId: viewer.id },
  }, { idempotencyKey: 'booking-' + kind + '-' + bookingId + '-' + amountCents });
  await paymentRepository.upsertPaymentFromIntent({
    paymentIntentId: intent.id,
    bookingKind: kind,
    bookingId,
    travelerId: viewer.id,
    amountCents,
    currency: 'eur',
    status: 'requires_payment_method',
  });
  return { clientSecret: intent.client_secret!, paymentIntentId: intent.id, amountCents };
}

export function listMyPayments(viewer: AuthUser): Promise<Payment[]> {
  return paymentRepository.listPayments({ travelerId: viewer.id });
}

export function listAllPayments(): Promise<Payment[]> {
  return paymentRepository.listPayments();
}

function bookingRefOf(intent: Stripe.PaymentIntent): BookingRef | null {
  const { bookingKind, bookingId, userId } = intent.metadata ?? {};
  if ((bookingKind !== 'stay' && bookingKind !== 'service') || !bookingId || !userId) return null;
  return { kind: bookingKind, bookingId, userId };
}

function findBooking(ref: BookingRef): Promise<StayBooking | ServiceBooking | null> {
  return ref.kind === 'stay'
    ? stayBookingRepository.findStayBookingById(ref.bookingId)
    : serviceBookingRepository.findServiceBookingById(ref.bookingId);
}

async function setBookingPaymentStatus(ref: BookingRef, paymentStatus: PaymentStatus): Promise<void> {
  if (ref.kind === 'stay') {
    await stayBookingRepository.updateStayBooking(ref.bookingId, { paymentStatus });
  } else {
    await serviceBookingRepository.updateServiceBooking(ref.bookingId, { paymentStatus });
  }
}

export async function applyPaymentIntentSucceeded(intent: Stripe.PaymentIntent): Promise<void> {
  const ref = bookingRefOf(intent);
  if (!ref) return;
  const booking = await findBooking(ref);
  if (!booking) return;
  const matches = intent.amount === booking.pricing.totalTtcCents && intent.currency === 'eur';
  await paymentRepository.upsertPaymentFromIntent({
    paymentIntentId: intent.id,
    bookingKind: ref.kind,
    bookingId: ref.bookingId,
    travelerId: ref.userId,
    amountCents: intent.amount,
    currency: intent.currency,
    status: matches ? 'succeeded' : 'amount_mismatch',
    lastError: matches ? null : 'Montant Stripe ' + intent.amount + ' différent du snapshot ' + booking.pricing.totalTtcCents,
  });
  if (matches && booking.paymentStatus !== 'paid') {
    await setBookingPaymentStatus(ref, 'paid');
    await emitTravelerInvoiceSafely(ref.kind, ref.bookingId);
  }
}

export async function applyPaymentIntentFailed(intent: Stripe.PaymentIntent): Promise<void> {
  const ref = bookingRefOf(intent);
  if (!ref) return;
  const booking = await findBooking(ref);
  if (!booking) return;
  await paymentRepository.upsertPaymentFromIntent({
    paymentIntentId: intent.id,
    bookingKind: ref.kind,
    bookingId: ref.bookingId,
    travelerId: ref.userId,
    amountCents: intent.amount,
    currency: intent.currency,
    status: 'failed',
    lastError: intent.last_payment_error?.message ?? (intent.status === 'canceled' ? 'Paiement annulé' : null),
  });
  if (booking.paymentStatus !== 'paid') {
    await setBookingPaymentStatus(ref, 'payment_failed');
    if (ref.kind === 'service') {
      await vipQuotaUsageRepository.releaseQuotaForBooking(ref.bookingId);
    }
  }
}
