import type { RequestHandler } from 'express';
import * as subscriptionService from '../services/subscription.service';
import { checkoutSchema } from '../validators/subscription.schema';

export const createCheckout: RequestHandler = async (req, res) => {
  const { tier, interval } = checkoutSchema.parse(req.body);
  res.json(await subscriptionService.createCheckoutSession(req.user!.id, tier, interval));
};

export const createPortal: RequestHandler = async (req, res) => {
  res.json(await subscriptionService.createPortalSession(req.user!.id));
};

export const mySubscription: RequestHandler = async (req, res) => {
  res.json(await subscriptionService.getSubscriptionView(req.user!.id));
};

export const listSubscribers: RequestHandler = async (_req, res) => {
  res.json(await subscriptionService.listSubscribers());
};
