import type { PricingSnapshot } from '../api/types';
import { formatEuros } from '../lib/money';

export function PriceBreakdown({ pricing }: { pricing: PricingSnapshot }) {
  return (
    <div className="breakdown">
      <span>Montant HT</span>
      <span>{formatEuros(pricing.grossHtCents)}</span>
      {pricing.freeQuotaUsed ? (
        <>
          <span>Prestation offerte (avantage VIP)</span>
          <span>−{formatEuros(pricing.discountHtCents)}</span>
        </>
      ) : (
        pricing.discountHtCents > 0 && (
          <>
            <span>Remise VIP {pricing.discountBps / 100} %</span>
            <span>−{formatEuros(pricing.discountHtCents)}</span>
          </>
        )
      )}
      <span>TVA {pricing.vatRateBps / 100} %</span>
      <span>{formatEuros(pricing.vatCents)}</span>
      <span className="total">Total TTC</span>
      <span className="total">{formatEuros(pricing.totalTtcCents)}</span>
    </div>
  );
}
