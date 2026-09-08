import * as commissionTierRepository from '../repositories/commissionTier.repository';
import * as platformSettingsRepository from '../repositories/platformSettings.repository';
import * as vipPlanRepository from '../repositories/vipPlan.repository';
import type { PlatformSettings } from '../types/catalog';
import type { CommissionTier, PricingRule, VipPlan, VipTier } from '../types/pricing';
import { AppError } from '../utils/AppError';
import { computePriceHt } from './pricing/pricingEngine';

export async function getCommissionTiers(): Promise<CommissionTier[]> {
  const tiers = await commissionTierRepository.listCommissionTiers();
  if (tiers.length === 0) {
    throw new AppError(500, 'PRICING_NOT_CONFIGURED', 'Barème de commission absent : lancer le seed des tarifs');
  }
  return tiers;
}

export async function replaceCommissionTiers(tiers: CommissionTier[]): Promise<CommissionTier[]> {
  await commissionTierRepository.replaceCommissionTiers(tiers);
  return getCommissionTiers();
}

export function listVipPlans(): Promise<VipPlan[]> {
  return vipPlanRepository.listVipPlans();
}

export async function updateVipPlan(tier: VipTier, patch: Partial<Omit<VipPlan, 'tier'>>): Promise<VipPlan> {
  const existing = await vipPlanRepository.findVipPlanByTier(tier);
  if (!existing) {
    throw new AppError(404, 'VIP_PLAN_NOT_FOUND', 'Formule VIP introuvable');
  }
  const updated = { ...existing, ...patch, tier };
  await vipPlanRepository.upsertVipPlan(updated);
  return updated;
}

export function getSettings(): Promise<PlatformSettings> {
  return platformSettingsRepository.getSettings();
}

export function updateSettings(patch: Partial<PlatformSettings>): Promise<PlatformSettings> {
  return platformSettingsRepository.updateSettings(patch);
}

export function previewPrice(pricingRule: PricingRule, qty: number): { priceHtCents: number } {
  return { priceHtCents: computePriceHt(pricingRule, qty) };
}
