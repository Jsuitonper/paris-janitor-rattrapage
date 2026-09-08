import { z } from 'zod';

export const checkoutSchema = z.object({
  tier: z.enum(['bagpacker', 'explorator']),
  interval: z.enum(['monthly', 'yearly']),
});
