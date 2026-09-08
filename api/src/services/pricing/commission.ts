import type { CommissionTier } from '../../types/pricing';
import { bpsOf } from '../../utils/money';

function sortTiers(tiers: CommissionTier[]): CommissionTier[] {
  return [...tiers].sort((a, b) => (a.upToCents ?? Infinity) - (b.upToCents ?? Infinity));
}

export function commissionBpsFor(amountHtCents: number, tiers: CommissionTier[]): number {
  const tier = sortTiers(tiers).find((candidate) => candidate.upToCents === null || amountHtCents < candidate.upToCents);
  if (!tier) {
    throw new Error(`Aucun palier de commission ne couvre le montant ${amountHtCents}`);
  }
  return tier.rateBps;
}

export function computeCommission(amountHtCents: number, tiers: CommissionTier[]): { bps: number; cents: number } {
  const bps = commissionBpsFor(amountHtCents, tiers);
  return { bps, cents: bpsOf(amountHtCents, bps) };
}
