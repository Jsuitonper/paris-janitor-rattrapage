import type { RequestHandler } from 'express';
import * as pricingConfigService from '../services/pricingConfig.service';
import {
  commissionTiersSchema,
  pricePreviewSchema,
  settingsPatchSchema,
  vipPlanPatchSchema,
  vipTierSchema,
} from '../validators/pricing.schema';

export const getCommissionTiers: RequestHandler = async (_req, res) => {
  res.json(await pricingConfigService.getCommissionTiers());
};

export const replaceCommissionTiers: RequestHandler = async (req, res) => {
  res.json(await pricingConfigService.replaceCommissionTiers(commissionTiersSchema.parse(req.body)));
};

export const listVipPlans: RequestHandler = async (_req, res) => {
  res.json(await pricingConfigService.listVipPlans());
};

export const updateVipPlan: RequestHandler = async (req, res) => {
  const tier = vipTierSchema.parse(req.params.tier);
  res.json(await pricingConfigService.updateVipPlan(tier, vipPlanPatchSchema.parse(req.body)));
};

export const getSettings: RequestHandler = async (_req, res) => {
  res.json(await pricingConfigService.getSettings());
};

export const updateSettings: RequestHandler = async (req, res) => {
  res.json(await pricingConfigService.updateSettings(settingsPatchSchema.parse(req.body)));
};

export const previewPrice: RequestHandler = (req, res) => {
  const { pricingRule, qty } = pricePreviewSchema.parse(req.body);
  res.json(pricingConfigService.previewPrice(pricingRule, qty));
};
