import { z } from 'zod';
import { pricingRuleSchema } from './pricing.schema';

export const objectIdSchema = z.string().regex(/^[0-9a-f]{24}$/, 'Identifiant invalide');

export const providerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  job: z.string().trim().min(1).max(80),
  email: z.email(),
  phone: z.string().trim().min(6).max(20).nullable().optional(),
  status: z.enum(['candidate', 'validated', 'suspended']).optional(),
});
export const providerPatchSchema = providerSchema.partial();

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug invalide (minuscules, chiffres, tirets)'),
  description: z.string().max(500).optional(),
});
export const categoryPatchSchema = categorySchema.partial();

export const offeringSchema = z.object({
  name: z.string().trim().min(1).max(140),
  description: z.string().max(2000).optional(),
  categoryId: objectIdSchema,
  providerId: objectIdSchema,
  pricingRule: pricingRuleSchema,
  vatRateBps: z.number().int().min(0).max(10000).optional(),
  vipOnly: z.boolean().optional(),
  priorityAccess: z.boolean().optional(),
  active: z.boolean().optional(),
});
export const offeringPatchSchema = offeringSchema.partial();

export const dateRangeSchema = z
  .object({ start: z.coerce.date(), end: z.coerce.date() })
  .refine((range) => range.end > range.start, { message: 'La fin doit être après le début', path: ['end'] });

export const propertySchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().max(4000).optional(),
  address: z.object({
    street: z.string().trim().min(3).max(200),
    postalCode: z.string().regex(/^75[0-9]{3}$/, 'Code postal parisien attendu'),
    city: z.string().trim().min(1).default('Paris'),
    arrondissement: z.number().int().min(1).max(20),
  }),
  capacity: z.number().int().min(1).max(30),
  bedrooms: z.number().int().min(0).max(20).optional(),
  surfaceM2: z.number().int().min(5).max(2000),
  amenities: z.array(z.string().trim().min(1)).optional(),
  nightlyRateHtCents: z.number().int().min(100),
  vatRateBps: z.number().int().min(0).max(10000).optional(),
  blockedRanges: z.array(dateRangeSchema).optional(),
  status: z.enum(['draft', 'pending']).optional(),
});
export const propertyPatchSchema = propertySchema.partial();

export const propertyStatusSchema = z.object({
  status: z.enum(['draft', 'pending', 'published', 'rejected']),
  rejectionReason: z.string().max(500).optional(),
});

export const propertyListQuerySchema = z.object({
  status: z.enum(['draft', 'pending', 'published', 'rejected']).optional(),
});

export const catalogPropertyQuerySchema = z.object({
  arrondissement: z.coerce.number().int().min(1).max(20).optional(),
  capacity: z.coerce.number().int().min(1).optional(),
});
