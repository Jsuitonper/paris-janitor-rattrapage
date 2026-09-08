import * as userRepository from '../repositories/user.repository';
import * as vipPlanRepository from '../repositories/vipPlan.repository';
import type { VipPlan, VipTier } from '../types/pricing';
import type { User } from '../types/user';
import { AppError } from '../utils/AppError';

export function effectiveVipTier(user: User | null): VipTier {
  return user && user.vip.status === 'active' ? user.vip.tier : 'free';
}

export async function getPlanForTier(tier: VipTier): Promise<VipPlan> {
  const plan = await vipPlanRepository.findVipPlanByTier(tier);
  if (!plan) {
    throw new AppError(500, 'VIP_PLAN_MISSING', 'Formule VIP ' + tier + ' absente : lancer le seed des tarifs');
  }
  return plan;
}

export async function getUserPlan(userId: string | undefined): Promise<VipPlan> {
  const user = userId ? await userRepository.findUserById(userId) : null;
  return getPlanForTier(effectiveVipTier(user));
}
