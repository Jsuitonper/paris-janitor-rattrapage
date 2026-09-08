import { z } from 'zod';
import { objectIdSchema } from './catalog.schema';

export const fileUploadSchema = z.object({
  kind: z.enum(['property_photo', 'booking_attachment', 'inventory_report']),
  ownerUserId: objectIdSchema.optional(),
  propertyId: objectIdSchema.optional(),
  bookingId: objectIdSchema.optional(),
});

export const invoiceListQuerySchema = z.object({
  type: z.enum(['traveler', 'provider']).optional(),
});

export const providerPayoutSchema = z.object({
  year: z.coerce.number().int().min(2018).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const payoutStatusSchema = z.object({
  payoutStatus: z.enum(['pending', 'sent']),
});
