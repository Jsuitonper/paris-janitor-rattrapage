import { Router } from 'express';
import {
  getConversation,
  getInterventionSheet,
  listMyReviews,
  listMyThreads,
  postMessage,
  submitReview,
} from '../controllers/engagement.controller';
import { requireAuth } from '../middlewares/requireAuth';

export const reviewRouter = Router();
reviewRouter.use(requireAuth);
reviewRouter.get('/', listMyReviews);
reviewRouter.post('/', submitReview);

export const threadRouter = Router();
threadRouter.use(requireAuth);
threadRouter.get('/', listMyThreads);
threadRouter.get('/:id', getConversation);
threadRouter.post('/:id/messages', postMessage);

export const interventionRouter = Router();
interventionRouter.use(requireAuth);
interventionRouter.get('/:id', getInterventionSheet);
