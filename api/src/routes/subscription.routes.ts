import { Router } from 'express';
import { createCheckout, createPortal, mySubscription } from '../controllers/subscription.controller';
import { requireAuth } from '../middlewares/requireAuth';

export const subscriptionRouter = Router();

subscriptionRouter.use(requireAuth);
subscriptionRouter.get('/me', mySubscription);
subscriptionRouter.post('/checkout', createCheckout);
subscriptionRouter.post('/portal', createPortal);
