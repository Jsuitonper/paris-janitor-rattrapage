import type Stripe from 'stripe';
import { env } from '../config/env';
import { planForPriceId, priceIdFor, requireStripe, stripe, type BillingInterval, type PaidTier } from '../config/stripe';
import * as userRepository from '../repositories/user.repository';
import * as vipQuotaUsageRepository from '../repositories/vipQuotaUsage.repository';
import type { VipPlan, VipTier } from '../types/pricing';
import type { User, UserVip, VipStatus } from '../types/user';
import { AppError } from '../utils/AppError';
import { quotaWindowBounds, quotaWindowIndex } from './pricing/vipBenefits';
import { effectiveVipTier, getPlanForTier } from './vip.service';

export type QuotaView = { windowMonths: number; windowIndex: number; start: Date; end: Date; used: boolean; maxAmountTtcCents: number | null };

export type SubscriptionView = { vip: UserVip; effectiveTier: VipTier; plan: VipPlan; quota: QuotaView | null };

async function requireUser(userId: string): Promise<User> {
  const user = await userRepository.findUserById(userId);
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'Utilisateur introuvable');
  }
  return user;
}

export async function ensureCustomerId(user: User): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await requireStripe().customers.create({
    email: user.email,
    name: user.profile.firstName + ' ' + user.profile.lastName,
    metadata: { userId: user.id },
  });
  await userRepository.updateUser(user.id, { stripeCustomerId: customer.id });
  return customer.id;
}

export async function createCheckoutSession(userId: string, tier: PaidTier, interval: BillingInterval): Promise<{ url: string }> {
  const user = await requireUser(userId);
  if (user.vip.status === 'active') {
    throw new AppError(409, 'ALREADY_SUBSCRIBED', 'Un abonnement est déjà actif, utilisez le portail pour le modifier');
  }
  const session = await requireStripe().checkout.sessions.create({
    mode: 'subscription',
    customer: await ensureCustomerId(user),
    client_reference_id: user.id,
    line_items: [{ price: priceIdFor(tier, interval), quantity: 1 }],
    subscription_data: { metadata: { userId: user.id, tier } },
    success_url: env.APP_TRAVELER_URL + '/account?checkout=success',
    cancel_url: env.APP_TRAVELER_URL + '/vip?checkout=cancelled',
  });
  if (!session.url) {
    throw new AppError(502, 'STRIPE_ERROR', 'Stripe n’a pas renvoyé d’URL de paiement');
  }
  return { url: session.url };
}

export async function createPortalSession(userId: string): Promise<{ url: string }> {
  const user = await requireUser(userId);
  if (!user.stripeCustomerId) {
    throw new AppError(409, 'NO_STRIPE_CUSTOMER', 'Aucun abonnement Stripe associé à ce compte');
  }
  const session = await requireStripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: env.APP_TRAVELER_URL + '/account',
  });
  return { url: session.url };
}

export async function getSubscriptionView(userId: string, at = new Date()): Promise<SubscriptionView> {
  const user = await requireUser(userId);
  const effectiveTier = effectiveVipTier(user);
  const plan = await getPlanForTier(effectiveTier);
  let quota: QuotaView | null = null;
  if (plan.freeQuota && user.vip.anchorAt) {
    const { windowMonths, maxAmountTtcCents } = plan.freeQuota;
    const windowIndex = quotaWindowIndex(user.vip.anchorAt, windowMonths, at);
    const used = (await vipQuotaUsageRepository.listUsedWindowIndexes(userId, windowMonths)).includes(windowIndex);
    quota = { windowMonths, windowIndex, ...quotaWindowBounds(user.vip.anchorAt, windowMonths, windowIndex), used, maxAmountTtcCents };
  }
  return { vip: user.vip, effectiveTier, plan, quota };
}

export function listSubscribers(): Promise<User[]> {
  return userRepository.listSubscribers();
}

function mapStatus(status: Stripe.Subscription.Status): VipStatus {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'past_due' || status === 'unpaid') return 'past_due';
  if (status === 'canceled' || status === 'incomplete_expired') return 'canceled';
  return 'none';
}

function periodEndOf(subscription: Stripe.Subscription): Date | null {
  const item = subscription.items?.data?.[0] as { current_period_end?: number } | undefined;
  const legacy = (subscription as unknown as { current_period_end?: number }).current_period_end;
  const seconds = item?.current_period_end ?? legacy;
  return seconds ? new Date(seconds * 1000) : null;
}

export async function findUserForCustomer(customer: string | { id: string } | null, metadataUserId?: string): Promise<User | null> {
  const customerId = typeof customer === 'string' ? customer : customer?.id;
  if (customerId) {
    const user = await userRepository.findUserByStripeCustomerId(customerId);
    if (user) return user;
  }
  return metadataUserId ? userRepository.findUserById(metadataUserId) : null;
}

export async function linkCustomer(userId: string, customerId: string): Promise<void> {
  const user = await userRepository.findUserById(userId);
  if (user && !user.stripeCustomerId) {
    await userRepository.updateUser(userId, { stripeCustomerId: customerId });
  }
}

export async function applySubscription(user: User, subscription: Stripe.Subscription): Promise<void> {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const plan = priceId ? planForPriceId(priceId) : null;
  const status = mapStatus(subscription.status);
  const patch: Partial<UserVip> = {
    tier: status === 'canceled' || !plan ? 'free' : plan.tier,
    status,
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd: periodEndOf(subscription),
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    interval: plan?.interval ?? null,
  };
  if (!user.vip.anchorAt && status === 'active') {
    patch.anchorAt = new Date();
  }
  await userRepository.updateUserVip(user.id, patch);
}

export async function applySubscriptionDeleted(user: User): Promise<void> {
  await userRepository.updateUserVip(user.id, {
    tier: 'free',
    status: 'canceled',
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    interval: null,
  });
}

export async function applyInvoicePaid(user: User, invoice: Stripe.Invoice): Promise<void> {
  if (user.vip.status === 'past_due') {
    await userRepository.updateUserVip(user.id, { status: 'active' });
  }
  const eligibleForBonus =
    invoice.billing_reason === 'subscription_create' &&
    user.vip.tier === 'explorator' &&
    user.vip.interval === 'yearly' &&
    !user.vip.renewalBonusApplied &&
    env.STRIPE_RENEWAL_COUPON_ID !== undefined &&
    user.vip.stripeSubscriptionId !== null;
  if (eligibleForBonus) {
    if (stripe) {
      await stripe.subscriptions.update(user.vip.stripeSubscriptionId!, { discounts: [{ coupon: env.STRIPE_RENEWAL_COUPON_ID }] });
    }
    await userRepository.updateUserVip(user.id, { renewalBonusApplied: true });
  }
}

export async function applyInvoicePaymentFailed(user: User): Promise<void> {
  if (user.vip.status === 'active') {
    await userRepository.updateUserVip(user.id, { status: 'past_due' });
  }
}
