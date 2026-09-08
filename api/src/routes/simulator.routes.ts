import { Router } from 'express';
import { listOptions, simulate, submitContact } from '../controllers/quoteSimulator.controller';
import { rateLimit } from '../middlewares/rateLimit';

export const simulatorLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  message: 'Trop de simulations depuis cette adresse, réessayez dans une minute',
});

export const simulatorRouter = Router();

simulatorRouter.get('/options', listOptions);
simulatorRouter.post('/simulate', simulatorLimiter, simulate);
simulatorRouter.post('/leads/:id/contact', simulatorLimiter, submitContact);
