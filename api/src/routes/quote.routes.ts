import { Router } from 'express';
import { preview } from '../controllers/quote.controller';
import { requireAuth } from '../middlewares/requireAuth';

export const quoteRouter = Router();

quoteRouter.post('/preview', requireAuth, preview);
