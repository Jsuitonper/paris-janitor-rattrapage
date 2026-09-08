import { describe, expect, it } from 'vitest';
import { commissionBpsFor, computeCommission } from '../../src/services/pricing/commission';
import { DEFAULT_COMMISSION_TIERS } from '../../src/services/pricing/defaults';

describe('commissionBpsFor', () => {
  it.each([
    [499, 2000],
    [500, 1500],
    [4499, 1500],
    [4500, 1100],
    [7499, 1100],
    [7500, 900],
    [13999, 900],
    [14000, 700],
    [100000, 700],
  ])('%s centimes HT → %s bps (borne inférieure incluse)', (amount, bps) => {
    expect(commissionBpsFor(amount, DEFAULT_COMMISSION_TIERS)).toBe(bps);
  });

  it('accepte des paliers fournis dans le désordre', () => {
    const shuffled = [...DEFAULT_COMMISSION_TIERS].reverse();
    expect(commissionBpsFor(4499, shuffled)).toBe(1500);
    expect(commissionBpsFor(14000, shuffled)).toBe(700);
  });

  it('échoue si aucun palier ouvert ne couvre le montant', () => {
    expect(() => commissionBpsFor(99999, [{ upToCents: 500, rateBps: 2000 }])).toThrow();
  });
});

describe('computeCommission', () => {
  it('applique le taux du palier sur le montant HT', () => {
    expect(computeCommission(10000, DEFAULT_COMMISSION_TIERS)).toEqual({ bps: 900, cents: 900 });
    expect(computeCommission(333, DEFAULT_COMMISSION_TIERS)).toEqual({ bps: 2000, cents: 67 });
  });
});
