import type { VipContext, VipPlan } from '../../types/pricing';
import { bpsOf } from '../../utils/money';

export function monthsBetween(from: Date, to: Date): number {
  const months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  return to.getUTCDate() < from.getUTCDate() ? months - 1 : months;
}

export function quotaWindowIndex(anchorAt: Date, windowMonths: number, at: Date): number {
  return Math.floor(monthsBetween(anchorAt, at) / windowMonths);
}

export function discountFor(plan: VipPlan, grossHtCents: number): { bps: number; cents: number } {
  return { bps: plan.discountBps, cents: bpsOf(grossHtCents, plan.discountBps) };
}

export function freeQuotaEligibility(
  vip: VipContext,
  grossTtcCents: number,
  at: Date,
): { eligible: boolean; windowIndex: number | null } {
  const quota = vip.plan.freeQuota;
  if (!quota || !vip.anchorAt || at < vip.anchorAt) {
    return { eligible: false, windowIndex: null };
  }
  if (quota.maxAmountTtcCents !== null && grossTtcCents >= quota.maxAmountTtcCents) {
    return { eligible: false, windowIndex: null };
  }
  const windowIndex = quotaWindowIndex(vip.anchorAt, quota.windowMonths, at);
  return { eligible: !vip.usedWindowIndexes.includes(windowIndex), windowIndex };
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

export function quotaWindowBounds(anchorAt: Date, windowMonths: number, windowIndex: number): { start: Date; end: Date } {
  return {
    start: addMonths(anchorAt, windowIndex * windowMonths),
    end: addMonths(anchorAt, (windowIndex + 1) * windowMonths),
  };
}
