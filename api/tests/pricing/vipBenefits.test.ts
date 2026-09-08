import { describe, expect, it } from 'vitest';
import { discountFor, freeQuotaEligibility, quotaWindowBounds, quotaWindowIndex } from '../../src/services/pricing/vipBenefits';
import { ANCHOR, planFor, vipContext } from './fixtures';

describe('quotaWindowIndex', () => {
  it.each([
    ['2025-03-20', 12, 0],
    ['2026-03-10', 12, 0],
    ['2026-03-15', 12, 1],
    ['2026-03-16', 12, 1],
    ['2027-03-14', 12, 1],
    ['2025-09-14', 6, 0],
    ['2025-09-15', 6, 1],
    ['2026-03-14', 6, 1],
    ['2026-03-15', 6, 2],
  ])('souscription le 15/03/2025, le %s avec une fenêtre de %s mois → index %s', (date, months, index) => {
    expect(quotaWindowIndex(ANCHOR, months, new Date(`${date}T12:00:00Z`))).toBe(index);
  });
});

describe('discountFor', () => {
  it('Free et Bag Packer n’ont aucune remise permanente', () => {
    expect(discountFor(planFor('free'), 10000)).toEqual({ bps: 0, cents: 0 });
    expect(discountFor(planFor('bagpacker'), 10000)).toEqual({ bps: 0, cents: 0 });
  });

  it('Explorator a 5 % permanents', () => {
    expect(discountFor(planFor('explorator'), 10000)).toEqual({ bps: 500, cents: 500 });
  });
});

describe('freeQuotaEligibility', () => {
  const at = new Date('2025-03-20T12:00:00Z');

  it('Free n’a pas de prestation offerte', () => {
    expect(freeQuotaEligibility(vipContext('free'), 1000, at)).toEqual({ eligible: false, windowIndex: null });
  });

  it('sans date de souscription, pas de quota', () => {
    const context = { ...vipContext('explorator'), anchorAt: null };
    expect(freeQuotaEligibility(context, 1000, at)).toEqual({ eligible: false, windowIndex: null });
  });

  it('Bag Packer : 79,99 € TTC éligible, 80,00 € TTC non éligible', () => {
    expect(freeQuotaEligibility(vipContext('bagpacker'), 7999, at)).toEqual({ eligible: true, windowIndex: 0 });
    expect(freeQuotaEligibility(vipContext('bagpacker'), 8000, at)).toEqual({ eligible: false, windowIndex: null });
  });

  it('Explorator : aucun plafond de montant', () => {
    expect(freeQuotaEligibility(vipContext('explorator'), 250000, at)).toEqual({ eligible: true, windowIndex: 0 });
  });

  it('une fenêtre déjà consommée n’est plus éligible', () => {
    expect(freeQuotaEligibility(vipContext('explorator', [0]), 1000, at)).toEqual({ eligible: false, windowIndex: 0 });
  });

  it('une date antérieure à la souscription n’est pas éligible', () => {
    const before = new Date('2025-03-01T00:00:00Z');
    expect(freeQuotaEligibility(vipContext('explorator'), 1000, before)).toEqual({ eligible: false, windowIndex: null });
  });
});

describe('quotaWindowBounds', () => {
  it('borne la fenêtre courante sur les mois d’ancrage', () => {
    const anchor = new Date('2025-03-15T00:00:00Z');
    expect(quotaWindowBounds(anchor, 12, 0)).toEqual({ start: new Date('2025-03-15T00:00:00Z'), end: new Date('2026-03-15T00:00:00Z') });
    expect(quotaWindowBounds(anchor, 6, 1)).toEqual({ start: new Date('2025-09-15T00:00:00Z'), end: new Date('2026-03-15T00:00:00Z') });
  });
});
