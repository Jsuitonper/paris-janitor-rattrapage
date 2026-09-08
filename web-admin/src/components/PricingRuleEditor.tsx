import type { PricingRule } from '../api/types';
import { MoneyInput, OptionalNumberInput } from './inputs';

const UNITS: { value: PricingRule['unit']; label: string }[] = [
  { value: 'fixed', label: 'Prix fixe' },
  { value: 'km', label: 'Par kilomètre' },
  { value: 'hour', label: 'Par heure' },
  { value: 'm2', label: 'Par m²' },
  { value: 'item', label: 'Par unité' },
];

export const DEFAULT_RULE: PricingRule = { unit: 'fixed', baseCents: 0, tiers: [{ upToQty: null, unitPriceCents: 0 }], minCents: 100 };

type Props = { value: PricingRule; onChange: (rule: PricingRule) => void };

export function PricingRuleEditor({ value, onChange }: Props) {
  function updateTier(index: number, patch: Partial<PricingRule['tiers'][number]>) {
    onChange({ ...value, tiers: value.tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)) });
  }

  return (
    <div className="card">
      <label>
        Unité
        <select value={value.unit} onChange={(e) => onChange({ ...value, unit: e.target.value as PricingRule['unit'] })}>
          {UNITS.map((unit) => (
            <option key={unit.value} value={unit.value}>
              {unit.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Part fixe (€ HT)
        <MoneyInput cents={value.baseCents} onChange={(baseCents) => onChange({ ...value, baseCents })} />
      </label>
      <label>
        Minimum facturé (€ HT)
        <MoneyInput cents={value.minCents} onChange={(minCents) => onChange({ ...value, minCents })} />
      </label>
      {value.unit !== 'fixed' && (
        <>
          <p className="muted">Paliers marginaux : chaque palier facture les unités de sa tranche. Le dernier doit être ouvert (vide).</p>
          {value.tiers.map((tier, index) => (
            <div className="row" key={index}>
              <label>
                Jusqu’à (quantité)
                <OptionalNumberInput value={tier.upToQty} placeholder="ouvert" onChange={(upToQty) => updateTier(index, { upToQty })} />
              </label>
              <label>
                Prix unitaire (€ HT)
                <MoneyInput cents={tier.unitPriceCents} onChange={(unitPriceCents) => updateTier(index, { unitPriceCents })} />
              </label>
              <button
                type="button"
                className="secondary small"
                disabled={value.tiers.length === 1}
                onClick={() => onChange({ ...value, tiers: value.tiers.filter((_, i) => i !== index) })}
              >
                Retirer
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary small"
            onClick={() => onChange({ ...value, tiers: [...value.tiers, { upToQty: null, unitPriceCents: 0 }] })}
          >
            Ajouter un palier
          </button>
        </>
      )}
    </div>
  );
}
