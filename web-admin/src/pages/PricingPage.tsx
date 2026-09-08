import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { CommissionTier, PlatformSettings, SimulatorOption, VipPlan } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { MoneyInput, OptionalNumberInput, PercentInput } from '../components/inputs';

const TIER_LABELS = { free: 'Free', bagpacker: 'Bag Packer', explorator: 'Explorator' };

export function PricingPage() {
  const { token } = useAuth();
  const [tiers, setTiers] = useState<CommissionTier[]>([]);
  const [plans, setPlans] = useState<VipPlan[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function showError(err: unknown) {
    setMessage(null);
    setError(err instanceof Error ? err.message : 'Erreur');
  }

  useEffect(() => {
    api<CommissionTier[]>('/admin/pricing/commission-tiers', { token }).then(setTiers).catch(showError);
    api<VipPlan[]>('/admin/pricing/vip-plans', { token }).then(setPlans).catch(showError);
    api<PlatformSettings>('/admin/pricing/settings', { token }).then(setSettings).catch(showError);
  }, [token]);

  async function saveTiers() {
    setError(null);
    try {
      setTiers(await api<CommissionTier[]>('/admin/pricing/commission-tiers', { method: 'PUT', body: tiers, token }));
      setMessage('Barème de commission enregistré');
    } catch (err) {
      showError(err);
    }
  }

  function updateTier(index: number, patch: Partial<CommissionTier>) {
    setTiers(tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));
  }

  function updatePlan(tier: VipPlan['tier'], patch: Partial<VipPlan>) {
    setPlans(plans.map((plan) => (plan.tier === tier ? { ...plan, ...patch } : plan)));
  }

  async function savePlan(plan: VipPlan) {
    setError(null);
    const { tier, ...body } = plan;
    try {
      const saved = await api<VipPlan>('/admin/pricing/vip-plans/' + tier, { method: 'PATCH', body, token });
      updatePlan(tier, saved);
      setMessage('Formule ' + TIER_LABELS[tier] + ' enregistrée');
    } catch (err) {
      showError(err);
    }
  }

  function updateOption(index: number, patch: Partial<SimulatorOption>) {
    if (!settings) return;
    setSettings({ ...settings, simulatorOptions: settings.simulatorOptions.map((option, i) => (i === index ? { ...option, ...patch } : option)) });
  }

  async function saveSettings() {
    if (!settings) return;
    setError(null);
    try {
      setSettings(await api<PlatformSettings>('/admin/pricing/settings', { method: 'PATCH', body: settings, token }));
      setMessage('Paramètres enregistrés');
    } catch (err) {
      showError(err);
    }
  }

  return (
    <>
      <h1>Tarification</h1>
      {error && <p className="error">{error}</p>}
      {message && <p className="muted">{message}</p>}

      <section className="card">
        <h2>Barème de commission PJ (sur le HT des prestations)</h2>
        <p className="muted">Borne inférieure incluse. Le dernier palier doit rester ouvert (montant vide). Les réservations passées conservent leur snapshot.</p>
        {tiers.map((tier, index) => (
          <div className="row" key={index}>
            <label>Jusqu’à (€ HT)<OptionalNumberInput value={tier.upToCents === null ? null : tier.upToCents / 100} placeholder="ouvert" onChange={(v) => updateTier(index, { upToCents: v === null ? null : Math.round(v * 100) })} /></label>
            <label>Commission (%)<PercentInput bps={tier.rateBps} onChange={(rateBps) => updateTier(index, { rateBps })} /></label>
            <button type="button" className="secondary small" disabled={tiers.length === 1} onClick={() => setTiers(tiers.filter((_, i) => i !== index))}>Retirer</button>
          </div>
        ))}
        <div className="row">
          <button type="button" className="secondary" onClick={() => setTiers([...tiers, { upToCents: null, rateBps: 0 }])}>Ajouter un palier</button>
          <button type="button" onClick={saveTiers}>Enregistrer le barème</button>
        </div>
      </section>

      <section className="card">
        <h2>Formules VIP</h2>
        <table>
          <thead>
            <tr><th>Formule</th><th>Mensuel</th><th>Annuel</th><th>Remise</th><th>Offert : fenêtre (mois)</th><th>Offert : plafond TTC</th><th>Pubs</th><th>Prioritaire</th><th>Bonus renouv.</th><th></th></tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.tier}>
                <td><strong>{TIER_LABELS[plan.tier]}</strong></td>
                <td><MoneyInput cents={plan.monthlyPriceCents} onChange={(monthlyPriceCents) => updatePlan(plan.tier, { monthlyPriceCents })} /></td>
                <td><MoneyInput cents={plan.yearlyPriceCents} onChange={(yearlyPriceCents) => updatePlan(plan.tier, { yearlyPriceCents })} /></td>
                <td><PercentInput bps={plan.discountBps} onChange={(discountBps) => updatePlan(plan.tier, { discountBps })} /></td>
                <td><OptionalNumberInput value={plan.freeQuota?.windowMonths ?? null} placeholder="aucun" onChange={(v) => updatePlan(plan.tier, { freeQuota: v === null ? null : { windowMonths: v, maxAmountTtcCents: plan.freeQuota?.maxAmountTtcCents ?? null } })} /></td>
                <td><OptionalNumberInput value={plan.freeQuota?.maxAmountTtcCents == null ? null : plan.freeQuota.maxAmountTtcCents / 100} placeholder="sans plafond" onChange={(v) => plan.freeQuota && updatePlan(plan.tier, { freeQuota: { ...plan.freeQuota, maxAmountTtcCents: v === null ? null : Math.round(v * 100) } })} /></td>
                <td><input type="checkbox" checked={plan.showAds} onChange={(e) => updatePlan(plan.tier, { showAds: e.target.checked })} /></td>
                <td><input type="checkbox" checked={plan.priorityAccess} onChange={(e) => updatePlan(plan.tier, { priorityAccess: e.target.checked })} /></td>
                <td><PercentInput bps={plan.renewalBonusBps} onChange={(renewalBonusBps) => updatePlan(plan.tier, { renewalBonusBps })} /></td>
                <td><button type="button" className="small" onClick={() => savePlan(plan)}>Enregistrer</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {settings && (
        <section className="card">
          <h2>Paramètres plateforme</h2>
          <div className="row">
            <label>Commission sur les nuitées (%)<PercentInput bps={settings.stayCommissionBps} onChange={(stayCommissionBps) => setSettings({ ...settings, stayCommissionBps })} /></label>
            <label>Abonnement annuel bailleur (€)<MoneyInput cents={settings.ownerYearlyFeeCents} onChange={(ownerYearlyFeeCents) => setSettings({ ...settings, ownerYearlyFeeCents })} /></label>
            <button type="button" onClick={saveSettings}>Enregistrer</button>
          </div>
          <h3>Options proposées par le simulateur de gains</h3>
          <p className="muted">Ces options alimentent le formulaire public d’estimation. Le calcul les lit ici, rien n’est codé en dur.</p>
          {settings.simulatorOptions.map((option, index) => (
            <div className="row" key={index}>
              <label>Clé<input value={option.key} onChange={(e) => updateOption(index, { key: e.target.value })} /></label>
              <label>Libellé<input value={option.label} onChange={(e) => updateOption(index, { label: e.target.value })} /></label>
              <label>Prix (€ HT)<MoneyInput cents={option.priceHtCents} onChange={(priceHtCents) => updateOption(index, { priceHtCents })} /></label>
              <label>Fréquence<select value={option.frequency} onChange={(e) => updateOption(index, { frequency: e.target.value as SimulatorOption["frequency"] })}><option value="per_stay">Par séjour</option><option value="per_year">Par an</option></select></label>
              <button type="button" className="secondary small" onClick={() => setSettings({ ...settings, simulatorOptions: settings.simulatorOptions.filter((_, i) => i !== index) })}>Retirer</button>
            </div>
          ))}
          <div className="row">
            <button type="button" className="secondary" onClick={() => setSettings({ ...settings, simulatorOptions: [...settings.simulatorOptions, { key: "nouvelle-option", label: "Nouvelle option", priceHtCents: 0, frequency: "per_stay" }] })}>Ajouter une option</button>
            <button type="button" onClick={saveSettings}>Enregistrer les options</button>
          </div>
        </section>
      )}
    </>
  );
}
