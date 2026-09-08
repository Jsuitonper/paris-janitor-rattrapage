import type { RequestHandler } from 'express';
import type Stripe from 'stripe';
import { env } from '../config/env';
import { webhookVerifier } from '../config/stripe';
import { processStripeEvent } from '../services/stripeWebhook.service';
import { AppError } from '../utils/AppError';

export const handleStripeWebhook: RequestHandler = async (req, res) => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new AppError(503, 'STRIPE_NOT_CONFIGURED', 'Secret de webhook Stripe absent');
  }
  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string') {
    throw new AppError(400, 'INVALID_SIGNATURE', 'Signature Stripe manquante');
  }
  let event: Stripe.Event;
  try {
    event = webhookVerifier.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    throw new AppError(400, 'INVALID_SIGNATURE', 'Signature Stripe invalide');
  }
  res.json({ received: true, ...(await processStripeEvent(event)) });
};
