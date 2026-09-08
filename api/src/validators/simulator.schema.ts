import { z } from 'zod';

export const simulationInputSchema = z
  .object({
    arrondissement: z.number().int().min(1).max(20),
    surfaceM2: z.number().int().min(5).max(2000),
    capacity: z.number().int().min(1).max(30),
    bedrooms: z.number().int().min(0).max(20).default(1),
    nightlyRateHtCents: z.number().int().min(1000).max(10000000),
    occupancyRateBps: z.number().int().min(0).max(10000),
    averageStayNights: z.number().int().min(1).max(365).default(3),
    optionKeys: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  })
  .strict();

export const leadContactSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.email(),
    phone: z.string().trim().max(20).default(''),
  })
  .strict();

export const leadListQuerySchema = z.object({
  status: z.enum(['new', 'contacted', 'converted', 'archived']).optional(),
  withContact: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export const leadQualifySchema = z
  .object({
    status: z.enum(['new', 'contacted', 'converted', 'archived']).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();
