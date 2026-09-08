import { z } from 'zod';
import { objectIdSchema } from './catalog.schema';

export const paymentIntentSchema = z.object({
  kind: z.enum(['stay', 'service']),
  bookingId: objectIdSchema,
});
