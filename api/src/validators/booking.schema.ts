import { z } from 'zod';
import { objectIdSchema } from './catalog.schema';

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ');

export const stayQuoteSchema = z
  .object({
    propertyId: objectIdSchema,
    startDate: isoDay,
    endDate: isoDay,
    guests: z.number().int().min(1).max(30).default(1),
  })
  .refine((input) => input.endDate > input.startDate, { message: 'La date de départ doit suivre la date d’arrivée', path: ['endDate'] });

export const serviceQuoteSchema = z.object({
  offeringId: objectIdSchema,
  qty: z.number().positive().max(100000).default(1),
  scheduledAt: z.coerce.date(),
  stayBookingId: objectIdSchema.optional(),
  notes: z.string().max(1000).optional(),
});

export const quotePreviewSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('stay'), stay: stayQuoteSchema }),
  z.object({ kind: z.literal('service'), service: serviceQuoteSchema }),
]);

export const bookingStatusSchema = z.object({
  status: z.enum(['requested', 'confirmed', 'completed', 'cancelled']),
});

export const adminBookingQuerySchema = z.object({
  status: z.enum(['requested', 'confirmed', 'completed', 'cancelled']).optional(),
});
