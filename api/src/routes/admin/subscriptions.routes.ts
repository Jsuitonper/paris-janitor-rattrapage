import { Router } from 'express';
import { listSubscribers } from '../../controllers/subscription.controller';

export const adminSubscriptionsRouter = Router();

adminSubscriptionsRouter.get('/', listSubscribers);
