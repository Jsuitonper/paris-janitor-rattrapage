import { Router } from 'express';
import { createIntent, getConfig, listMine } from '../controllers/payment.controller';
import { requireAuth } from '../middlewares/requireAuth';

export const paymentRouter = Router();

paymentRouter.use(requireAuth);
paymentRouter.get('/config', getConfig);
paymentRouter.post('/intent', createIntent);
paymentRouter.get('/', listMine);
