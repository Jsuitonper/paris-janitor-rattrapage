import { CommissionTierModel } from '../models/CommissionTier.model';
import type { CommissionTier } from '../types/pricing';

export async function listCommissionTiers(): Promise<CommissionTier[]> {
  const docs = await CommissionTierModel.find().lean<CommissionTier[]>();
  return docs.map(({ upToCents, rateBps }) => ({ upToCents, rateBps }));
}

export async function replaceCommissionTiers(tiers: CommissionTier[]): Promise<void> {
  await CommissionTierModel.deleteMany({});
  await CommissionTierModel.insertMany(tiers);
}
