import { z } from 'zod';

const pricingTierSchema = z.object({
  upToQty: z.number().positive().nullable(),
  unitPriceCents: z.number().int().min(0),
});

export const pricingRuleSchema = z
  .object({
    unit: z.enum(['fixed', 'km', 'hour', 'm2', 'item']),
    baseCents: z.number().int().min(0),
    tiers: z.array(pricingTierSchema).min(1),
    minCents: z.number().int().min(100),
  })
  .superRefine((rule, ctx) => {
    rule.tiers.forEach((tier, index) => {
      const isLast = index === rule.tiers.length - 1;
      const previous = rule.tiers[index - 1];
      if (isLast && tier.upToQty !== null) {
        ctx.addIssue({ code: 'custom', path: ['tiers', index, 'upToQty'], message: 'Le dernier palier doit être ouvert (upToQty null)' });
      }
      if (!isLast && tier.upToQty === null) {
        ctx.addIssue({ code: 'custom', path: ['tiers', index, 'upToQty'], message: 'Seul le dernier palier peut être ouvert' });
      }
      if (previous && previous.upToQty !== null && tier.upToQty !== null && tier.upToQty <= previous.upToQty) {
        ctx.addIssue({ code: 'custom', path: ['tiers', index, 'upToQty'], message: 'Les paliers doivent être strictement croissants' });
      }
    });
  });

export const commissionTiersSchema = z
  .array(
    z.object({
      upToCents: z.number().int().positive().nullable(),
      rateBps: z.number().int().min(0).max(10000),
    }),
  )
  .min(1)
  .superRefine((tiers, ctx) => {
    tiers.forEach((tier, index) => {
      const isLast = index === tiers.length - 1;
      const previous = tiers[index - 1];
      if (isLast && tier.upToCents !== null) {
        ctx.addIssue({ code: 'custom', path: [index, 'upToCents'], message: 'Le dernier palier doit être ouvert (upToCents null)' });
      }
      if (!isLast && tier.upToCents === null) {
        ctx.addIssue({ code: 'custom', path: [index, 'upToCents'], message: 'Seul le dernier palier peut être ouvert' });
      }
      if (previous && previous.upToCents !== null && tier.upToCents !== null && tier.upToCents <= previous.upToCents) {
        ctx.addIssue({ code: 'custom', path: [index, 'upToCents'], message: 'Les paliers doivent être strictement croissants' });
      }
    });
  });

export const vipTierSchema = z.enum(['free', 'bagpacker', 'explorator']);

export const vipPlanPatchSchema = z
  .object({
    monthlyPriceCents: z.number().int().min(0),
    yearlyPriceCents: z.number().int().min(0),
    discountBps: z.number().int().min(0).max(10000),
    freeQuota: z
      .object({
        windowMonths: z.number().int().min(1).max(60),
        maxAmountTtcCents: z.number().int().positive().nullable(),
      })
      .nullable(),
    showAds: z.boolean(),
    priorityAccess: z.boolean(),
    renewalBonusBps: z.number().int().min(0).max(10000),
  })
  .partial();

export const simulatorOptionSchema = z.object({
  key: z.string().regex(/^[a-z0-9_-]+$/, 'Clé invalide (minuscules, chiffres, tirets)'),
  label: z.string().trim().min(1).max(120),
  priceHtCents: z.number().int().min(0),
  frequency: z.enum(['per_stay', 'per_year']),
});

export const settingsPatchSchema = z
  .object({
    stayCommissionBps: z.number().int().min(0).max(10000),
    ownerYearlyFeeCents: z.number().int().min(0),
    simulatorOptions: z.array(simulatorOptionSchema).max(20),
  })
  .partial();

export const pricePreviewSchema = z.object({
  pricingRule: pricingRuleSchema,
  qty: z.number().positive(),
});
