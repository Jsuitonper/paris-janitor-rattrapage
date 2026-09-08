import Stripe from 'stripe';
import type { VipTier } from '../types/pricing';
import { AppError } from '../utils/AppError';
import { env } from './env';

export type BillingInterval = 'monthly' | 'yearly';

export type PaidTier = Exclude<VipTier, 'free'>;

export const stripe: Stripe | null = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

export const webhookVerifier = new Stripe(env.STRIPE_SECRET_KEY ?? 'sk_test_webhook_verification_only');

export function requireStripe(): Stripe {
  if (!stripe) {
    throw new AppError(503, 'STRIPE_NOT_CONFIGURED', 'Stripe n’est pas configuré sur ce serveur');
  }
  return stripe;
}

const PRICE_IDS: Record<PaidTier, Record<BillingInterval, string | undefined>> = {
  bagpacker: { monthly: env.STRIPE_PRICE_BAGPACKER_MONTHLY, yearly: env.STRIPE_PRICE_BAGPACKER_YEARLY },
  explorator: { monthly: env.STRIPE_PRICE_EXPLORATOR_MONTHLY, yearly: env.STRIPE_PRICE_EXPLORATOR_YEARLY },
};

export function priceIdFor(tier: PaidTier, interval: BillingInterval): string {
  const id = PRICE_IDS[tier][interval];
  if (!id) {
    throw new AppError(503, 'STRIPE_NOT_CONFIGURED', 'Prix Stripe manquant pour ' + tier + ' ' + interval);
  }
  return id;
}

export function planForPriceId(priceId: string): { tier: PaidTier; interval: BillingInterval } | null {
  for (const tier of ['bagpacker', 'explorator'] as PaidTier[]) {
    for (const interval of ['monthly', 'yearly'] as BillingInterval[]) {
      if (PRICE_IDS[tier][interval] === priceId) return { tier, interval };
    }
  }
  return null;
}
