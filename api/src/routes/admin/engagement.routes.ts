import { Router } from 'express';
import {
  adminCompleteSheet,
  adminListReviews,
  adminListSheets,
  adminListThreads,
  adminModerateReview,
  getConversation,
  postMessage,
} from '../../controllers/engagement.controller';

export const adminInterventionsRouter = Router();
adminInterventionsRouter.get('/', adminListSheets);
adminInterventionsRouter.patch('/:id/complete', adminCompleteSheet);

export const adminReviewsRouter = Router();
adminReviewsRouter.get('/', adminListReviews);
adminReviewsRouter.patch('/:id/moderation', adminModerateReview);

export const adminThreadsRouter = Router();
adminThreadsRouter.get('/', adminListThreads);
adminThreadsRouter.get('/:id', getConversation);
adminThreadsRouter.post('/:id/messages', postMessage);
