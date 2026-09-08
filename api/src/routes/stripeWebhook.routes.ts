import { Router } from 'express';
import { handleStripeWebhook } from '../controllers/stripeWebhook.controller';

export const stripeWebhookRouter = Router();

stripeWebhookRouter.post('/webhook', handleStripeWebhook);
