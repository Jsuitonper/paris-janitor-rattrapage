import type { RequestHandler } from 'express';
import * as interventionSheetService from '../services/interventionSheet.service';
import * as messagingService from '../services/messaging.service';
import * as reviewService from '../services/review.service';
import {
  interventionListQuerySchema,
  interventionReportSchema,
  messageSchema,
  moderationSchema,
  publicReviewQuerySchema,
  reviewListQuerySchema,
  reviewSchema,
} from '../validators/engagement.schema';

export const getInterventionSheet: RequestHandler = async (req, res) => {
  res.json(await interventionSheetService.getForViewer(req.params.id as string, req.user!));
};

export const adminListSheets: RequestHandler = async (req, res) => {
  res.json(await interventionSheetService.listSheets(interventionListQuerySchema.parse(req.query).status));
};

export const adminCompleteSheet: RequestHandler = async (req, res) => {
  const report = interventionReportSchema.parse(req.body);
  res.json(await interventionSheetService.completeSheet(req.params.id as string, report, req.user!.id));
};

export const submitReview: RequestHandler = async (req, res) => {
  const body = reviewSchema.parse(req.body);
  res.status(201).json(await reviewService.submitReview(req.user!, body));
};

export const listMyReviews: RequestHandler = async (req, res) => {
  res.json(await reviewService.listMyReviews(req.user!));
};

export const listPublicReviews: RequestHandler = async (req, res) => {
  res.json(await reviewService.listPublicReviews(publicReviewQuerySchema.parse(req.query)));
};

export const adminListReviews: RequestHandler = async (req, res) => {
  res.json(await reviewService.listForModeration(reviewListQuerySchema.parse(req.query).moderation));
};

export const adminModerateReview: RequestHandler = async (req, res) => {
  const { moderation, moderationReason } = moderationSchema.parse(req.body);
  res.json(await reviewService.moderateReview(req.params.id as string, moderation, moderationReason ?? null));
};

export const getConversation: RequestHandler = async (req, res) => {
  res.json(await messagingService.getConversation(req.params.id as string, req.user!));
};

export const postMessage: RequestHandler = async (req, res) => {
  const { body } = messageSchema.parse(req.body);
  res.status(201).json(await messagingService.postMessage(req.params.id as string, req.user!, body));
};

export const listMyThreads: RequestHandler = async (req, res) => {
  res.json(await messagingService.listMyThreads(req.user!));
};

export const adminListThreads: RequestHandler = async (_req, res) => {
  res.json(await messagingService.listAllThreads());
};
