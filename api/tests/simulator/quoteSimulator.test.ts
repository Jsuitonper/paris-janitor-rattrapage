import { describe, expect, it } from 'vitest';
import { computeBreakdown } from '../../src/services/quoteSimulator.service';
import { DEFAULT_SIMULATOR_OPTIONS } from '../../src/services/pricing/defaults';
import type { SimulationInput } from '../../src/types/lead';

const SETTINGS = { stayCommissionBps: 2000, ownerYearlyFeeCents: 10000, simulatorOptions: DEFAULT_SIMULATOR_OPTIONS };

const INPUT: SimulationInput = {
  arrondissement: 2,
  surfaceM2: 25,
  capacity: 2,
  bedrooms: 1,
  nightlyRateHtCents: 12000,
  occupancyRateBps: 6000,
  averageStayNights: 3,
  optionKeys: [],
};

describe('computeBreakdown', () => {
  it('ventile le calcul au lieu de renvoyer un chiffre unique', () => {
    const result = computeBreakdown(INPUT, SETTINGS);
    expect(result.assumptions.occupiedNights).toBe(219);
    expect(result.assumptions.estimatedStays).toBe(73);
    expect(result.grossRevenueHtCents).toBe(219 * 12000);
    expect(result.charges.platformCommissionHtCents).toBe(525600);
    expect(result.charges.ownerYearlyFeeCents).toBe(10000);
    expect(result.charges.totalHtCents).toBe(535600);
    expect(result.net.yearlyHtCents).toBe(2628000 - 535600);
    expect(result.net.monthlyHtCents).toBe(Math.round(2092400 / 12));
    expect(result.net.perOccupiedNightHtCents).toBe(Math.round(2092400 / 219));
  });

  it('le taux d’occupation est ajustable et fait varier toute la ventilation', () => {
    const low = computeBreakdown({ ...INPUT, occupancyRateBps: 3000 }, SETTINGS);
    const high = computeBreakdown({ ...INPUT, occupancyRateBps: 9000 }, SETTINGS);
    expect(low.assumptions.occupiedNights).toBe(110);
    expect(high.assumptions.occupiedNights).toBe(329);
    expect(high.grossRevenueHtCents).toBeGreaterThan(low.grossRevenueHtCents);
    expect(high.charges.platformCommissionHtCents).toBeGreaterThan(low.charges.platformCommissionHtCents);
    expect(high.charges.ownerYearlyFeeCents).toBe(low.charges.ownerYearlyFeeCents);
  });

  it('les options par séjour sont multipliées par le nombre de séjours estimé', () => {
    const result = computeBreakdown({ ...INPUT, optionKeys: ['cleaning', 'photos'] }, SETTINGS);
    const cleaning = result.charges.options.find((option) => option.key === 'cleaning')!;
    const photos = result.charges.options.find((option) => option.key === 'photos')!;
    expect(cleaning).toMatchObject({ frequency: 'per_stay', quantity: 73, unitPriceHtCents: 5000, totalHtCents: 365000 });
    expect(photos).toMatchObject({ frequency: 'per_year', quantity: 1, totalHtCents: 18000 });
    expect(result.charges.optionsHtCents).toBe(383000);
    expect(result.charges.totalHtCents).toBe(525600 + 10000 + 383000);
  });

  it('une clé d’option inconnue est ignorée', () => {
    const result = computeBreakdown({ ...INPUT, optionKeys: ['cleaning', 'inexistante'] }, SETTINGS);
    expect(result.charges.options.map((option) => option.key)).toEqual(['cleaning']);
  });

  it('la commission et l’abonnement viennent de la configuration, jamais codés en dur', () => {
    const custom = computeBreakdown(INPUT, { ...SETTINGS, stayCommissionBps: 3500, ownerYearlyFeeCents: 25000 });
    expect(custom.assumptions.commissionBps).toBe(3500);
    expect(custom.charges.platformCommissionHtCents).toBe(919800);
    expect(custom.charges.ownerYearlyFeeCents).toBe(25000);
  });

  it('le résultat est reproductible et entièrement en centimes entiers', () => {
    const input = { ...INPUT, optionKeys: ['cleaning', 'linen', 'pricing'] };
    expect(computeBreakdown(input, SETTINGS)).toEqual(computeBreakdown(input, SETTINGS));
    const result = computeBreakdown(input, SETTINGS);
    const amounts = [
      result.grossRevenueHtCents,
      result.charges.platformCommissionHtCents,
      result.charges.optionsHtCents,
      result.charges.totalHtCents,
      result.net.yearlyHtCents,
      result.net.monthlyHtCents,
      result.net.perOccupiedNightHtCents,
      ...result.charges.options.map((option) => option.totalHtCents),
    ];
    expect(amounts.every(Number.isInteger)).toBe(true);
  });

  it('une occupation nulle ne divise jamais par zéro', () => {
    const result = computeBreakdown({ ...INPUT, occupancyRateBps: 0, optionKeys: ['cleaning'] }, SETTINGS);
    expect(result.assumptions.occupiedNights).toBe(0);
    expect(result.grossRevenueHtCents).toBe(0);
    expect(result.net.perOccupiedNightHtCents).toBe(0);
    expect(result.net.yearlyHtCents).toBe(-10000);
  });
});
