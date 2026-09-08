import { z } from 'zod';
import { objectIdSchema } from './catalog.schema';

export const interventionReportSchema = z.object({
  performedAt: z.coerce.date(),
  durationMinutes: z.number().int().min(1).max(10080),
  workDone: z.string().trim().min(3).max(4000),
  materialsUsed: z.string().max(2000).optional().default(''),
  incidents: z.string().max(2000).optional().default(''),
  attachmentIds: z.array(objectIdSchema).max(10).optional().default([]),
});

export const interventionListQuerySchema = z.object({
  status: z.enum(['prefilled', 'completed']).optional(),
});

export const reviewSchema = z.object({
  bookingId: objectIdSchema,
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional().default(''),
});

export const moderationSchema = z.object({
  moderation: z.enum(['approved', 'rejected', 'pending']),
  moderationReason: z.string().max(500).nullable().optional(),
});

export const reviewListQuerySchema = z.object({
  moderation: z.enum(['pending', 'approved', 'rejected']).optional(),
});

export const publicReviewQuerySchema = z.object({
  providerId: objectIdSchema.optional(),
  offeringId: objectIdSchema.optional(),
});

export const messageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});
