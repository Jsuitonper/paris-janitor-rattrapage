import { describe, expect, it } from 'vitest';
import { DEFAULT_COMMISSION_TIERS } from '../../src/services/pricing/defaults';
import { quoteService, quoteStay, type ServiceQuoteInput } from '../../src/services/pricing/quote';
import type { VipTier } from '../../src/types/pricing';
import { expectIntegerCents, fixedRule, taxiRule, vipContext } from './fixtures';

function serviceInput(overrides: Partial<ServiceQuoteInput> & { tier: VipTier; used?: number[] }): ServiceQuoteInput {
  const { tier, used, ...rest } = overrides;
  return {
    pricingRule: fixedRule(10000),
    qty: 1,
    vatRateBps: 2000,
    commissionTiers: DEFAULT_COMMISSION_TIERS,
    vip: vipContext(tier, used ?? [0]),
    at: new Date('2025-03-20T12:00:00Z'),
    ...rest,
  };
}

describe('quoteService', () => {
  it('la remise Explorator est absorbée par PJ : le prestataire touche la même chose qu’avec un Free', () => {
    const free = quoteService(serviceInput({ tier: 'free' }));
    const explorator = quoteService(serviceInput({ tier: 'explorator' }));

    expect(free.grossHtCents).toBe(10000);
    expect(explorator.grossHtCents).toBe(10000);
    expect(free.commissionBps).toBe(900);
    expect(explorator.commissionBps).toBe(900);
    expect(free.providerNetHtCents).toBe(9100);
    expect(explorator.providerNetHtCents).toBe(9100);

    expect(free.discountHtCents).toBe(0);
    expect(explorator.discountHtCents).toBe(500);
    expect(free.travelerPaysHtCents).toBe(10000);
    expect(explorator.travelerPaysHtCents).toBe(9500);
    expect(free.platformMarginHtCents).toBe(900);
    expect(explorator.platformMarginHtCents).toBe(400);
  });

  it('Bag Packer paie plein tarif hors prestation offerte', () => {
    const snapshot = quoteService(serviceInput({ tier: 'bagpacker', pricingRule: fixedRule(12000) }));
    expect(snapshot.freeQuotaUsed).toBe(false);
    expect(snapshot.discountHtCents).toBe(0);
    expect(snapshot.travelerPaysHtCents).toBe(12000);
    expect(snapshot.totalTtcCents).toBe(14400);
  });

  it('prestation offerte : le voyageur paie 0, le prestataire est payé, PJ porte la marge négative', () => {
    const snapshot = quoteService(serviceInput({ tier: 'explorator', used: [] }));

    expect(snapshot.freeQuotaUsed).toBe(true);
    expect(snapshot.quotaWindowIndex).toBe(0);
    expect(snapshot.travelerPaysHtCents).toBe(0);
    expect(snapshot.vatCents).toBe(0);
    expect(snapshot.totalTtcCents).toBe(0);
    expect(snapshot.providerNetHtCents).toBe(9100);
    expect(snapshot.platformMarginHtCents).toBe(-9100);
  });

  it('plafond Bag Packer : 79,99 € TTC offert, 80,00 € TTC facturé et quota intact', () => {
    const eligible = quoteService(serviceInput({ tier: 'bagpacker', used: [], pricingRule: fixedRule(6666) }));
    expect(eligible.totalTtcCents).toBe(0);
    expect(eligible.freeQuotaUsed).toBe(true);

    const tooExpensive = quoteService(serviceInput({ tier: 'bagpacker', used: [], pricingRule: fixedRule(6667) }));
    expect(tooExpensive.freeQuotaUsed).toBe(false);
    expect(tooExpensive.quotaWindowIndex).toBeNull();
    expect(tooExpensive.discountHtCents).toBe(0);
    expect(tooExpensive.totalTtcCents).toBe(8000);
  });

  it('fenêtre de quota ancrée sur la souscription du 15/03', () => {
    const cheap = { tier: 'bagpacker' as const, pricingRule: fixedRule(5000) };

    const first = quoteService(serviceInput({ ...cheap, used: [], at: new Date('2025-03-20T12:00:00Z') }));
    expect(first.freeQuotaUsed).toBe(true);
    expect(first.quotaWindowIndex).toBe(0);

    const refused = quoteService(serviceInput({ ...cheap, used: [0], at: new Date('2026-03-10T12:00:00Z') }));
    expect(refused.freeQuotaUsed).toBe(false);
    expect(refused.totalTtcCents).toBe(6000);

    const renewed = quoteService(serviceInput({ ...cheap, used: [0], at: new Date('2026-03-16T12:00:00Z') }));
    expect(renewed.freeQuotaUsed).toBe(true);
    expect(renewed.quotaWindowIndex).toBe(1);
  });

  it('un aperçu ne consomme rien : deux appels identiques donnent le même snapshot', () => {
    const input = serviceInput({ tier: 'explorator', used: [] });
    expect(quoteService(input)).toEqual(quoteService(input));
  });

  it('le snapshot embarque une copie indépendante du barème', () => {
    const input = serviceInput({ tier: 'free', pricingRule: structuredClone(taxiRule), qty: 5 });
    const snapshot = quoteService(input);
    input.pricingRule.tiers[0].unitPriceCents = 999;
    expect(snapshot.pricingRuleSnapshot.tiers[0].unitPriceCents).toBe(200);
  });

  it('aucun flottant ne sort du module, même avec une quantité fractionnaire et une remise', () => {
    const snapshot = quoteService(serviceInput({ tier: 'explorator', pricingRule: taxiRule, qty: 10.5 }));
    expect(snapshot.grossHtCents).toBe(2075);
    expect(snapshot.discountHtCents).toBe(104);
    expect(snapshot.travelerPaysHtCents).toBe(1971);
    expect(snapshot.vatCents).toBe(394);
    expect(snapshot.totalTtcCents).toBe(2365);
    expectIntegerCents(snapshot);
  });
});

describe('quoteStay', () => {
  it('3 nuits : commission plateforme à 20 %, aucune remise VIP sur les nuitées', () => {
    const snapshot = quoteStay({ nights: 3, nightlyRateHtCents: 10000, vatRateBps: 1000, stayCommissionBps: 2000 });

    expect(snapshot.kind).toBe('stay');
    expect(snapshot.grossHtCents).toBe(30000);
    expect(snapshot.discountBps).toBe(0);
    expect(snapshot.discountHtCents).toBe(0);
    expect(snapshot.freeQuotaUsed).toBe(false);
    expect(snapshot.commissionHtCents).toBe(6000);
    expect(snapshot.providerNetHtCents).toBe(24000);
    expect(snapshot.travelerPaysHtCents).toBe(30000);
    expect(snapshot.totalTtcCents).toBe(33000);
    expectIntegerCents(snapshot);
  });
});
