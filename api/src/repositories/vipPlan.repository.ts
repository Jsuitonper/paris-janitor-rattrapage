import { VipPlanModel } from '../models/VipPlan.model';
import type { VipPlan, VipTier } from '../types/pricing';

function toVipPlan(doc: VipPlan): VipPlan {
  return {
    tier: doc.tier,
    monthlyPriceCents: doc.monthlyPriceCents,
    yearlyPriceCents: doc.yearlyPriceCents,
    discountBps: doc.discountBps,
    freeQuota: doc.freeQuota
      ? { windowMonths: doc.freeQuota.windowMonths, maxAmountTtcCents: doc.freeQuota.maxAmountTtcCents ?? null }
      : null,
    showAds: doc.showAds,
    priorityAccess: doc.priorityAccess,
    renewalBonusBps: doc.renewalBonusBps,
  };
}

export async function listVipPlans(): Promise<VipPlan[]> {
  const docs = await VipPlanModel.find().lean<VipPlan[]>();
  return docs.map(toVipPlan);
}

export async function findVipPlanByTier(tier: VipTier): Promise<VipPlan | null> {
  const doc = await VipPlanModel.findOne({ tier }).lean<VipPlan>();
  return doc ? toVipPlan(doc) : null;
}

export async function upsertVipPlan(plan: VipPlan): Promise<void> {
  await VipPlanModel.findOneAndUpdate({ tier: plan.tier }, plan, { upsert: true });
}
