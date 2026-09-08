import { Router } from 'express';
import {
  getCommissionTiers,
  getSettings,
  listVipPlans,
  previewPrice,
  replaceCommissionTiers,
  updateSettings,
  updateVipPlan,
} from '../../controllers/pricingConfig.controller';

export const adminPricingRouter = Router();

adminPricingRouter.get('/commission-tiers', getCommissionTiers);
adminPricingRouter.put('/commission-tiers', replaceCommissionTiers);
adminPricingRouter.get('/vip-plans', listVipPlans);
adminPricingRouter.patch('/vip-plans/:tier', updateVipPlan);
adminPricingRouter.get('/settings', getSettings);
adminPricingRouter.patch('/settings', updateSettings);
adminPricingRouter.post('/preview', previewPrice);
