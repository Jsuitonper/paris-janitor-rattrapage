import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { PricingRule, Provider, ServiceCategory, ServiceOffering } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { PercentInput } from '../components/inputs';
import { DEFAULT_RULE, PricingRuleEditor } from '../components/PricingRuleEditor';
import { formatEuros } from '../lib/money';

type Form = {
  name: string;
  description: string;
  categoryId: string;
  providerId: string;
  pricingRule: PricingRule;
  vatRateBps: number;
  vipOnly: boolean;
  priorityAccess: boolean;
  active: boolean;
};

const EMPTY: Form = { name: '', description: '', categoryId: '', providerId: '', pricingRule: DEFAULT_RULE, vatRateBps: 2000, vipOnly: false, priorityAccess: false, active: true };

export function OfferingsPage() {
  const { token } = useAuth();
  const [offerings, setOfferings] = useState<ServiceOffering[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewQty, setPreviewQty] = useState('1');
  const [preview, setPreview] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function showError(err: unknown) {
    setError(err instanceof Error ? err.message : 'Erreur');
  }

  function load() {
    api<ServiceOffering[]>('/admin/offerings', { token }).then(setOfferings).catch(showError);
    api<ServiceCategory[]>('/admin/categories', { token }).then(setCategories).catch(showError);
    api<Provider[]>('/admin/providers', { token }).then(setProviders).catch(showError);
  }

  useEffect(load, [token]);

  async function computePreview() {
    setError(null);
    try {
      const result = await api<{ priceHtCents: number }>('/admin/pricing/preview', {
        method: 'POST',
        body: { pricingRule: form.pricingRule, qty: Number(previewQty) },
        token,
      });
      setPreview(result.priceHtCents);
    } catch (err) {
      showError(err);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (editingId) {
        await api('/admin/offerings/' + editingId, { method: 'PATCH', body: form, token });
      } else {
        await api('/admin/offerings', { method: 'POST', body: form, token });
      }
      setForm(EMPTY);
      setEditingId(null);
      setPreview(null);
      load();
    } catch (err) {
      showError(err);
    }
  }

  function edit(offering: ServiceOffering) {
    setEditingId(offering.id);
    const { id: _id, ...rest } = offering;
    setForm(rest);
  }

  async function remove(id: string) {
    if (!window.confirm('Supprimer cette prestation ?')) return;
    try {
      await api('/admin/offerings/' + id, { method: 'DELETE', token });
      load();
    } catch (err) {
      showError(err);
    }
  }

  const nameOf = (list: { id: string; name: string }[], id: string) => list.find((item) => item.id === id)?.name ?? '?';

  return (
    <>
      <h1>Prestations</h1>
      {error && <p className="error">{error}</p>}
      <div className="two-columns">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Catégorie</th>
              <th>Prestataire</th>
              <th>Unité</th>
              <th>VIP</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {offerings.map((o) => (
              <tr key={o.id}>
                <td>{o.name}</td>
                <td>{nameOf(categories, o.categoryId)}</td>
                <td>{nameOf(providers, o.providerId)}</td>
                <td>{o.pricingRule.unit}</td>
                <td>{o.vipOnly ? 'Explorator' : '—'}</td>
                <td>{o.active ? 'oui' : 'non'}</td>
                <td className="row">
                  <button type="button" className="secondary small" onClick={() => edit(o)}>Modifier</button>
                  <button type="button" className="danger small" onClick={() => remove(o.id)}>Supprimer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form className="card" onSubmit={submit}>
          <h2>{editingId ? 'Modifier' : 'Nouvelle prestation'}</h2>
          <label>
            Nom
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Description
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </label>
          <label>
            Catégorie
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>
            Prestataire
            <select value={form.providerId} onChange={(e) => setForm({ ...form, providerId: e.target.value })} required>
              <option value="">—</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>
            TVA (%)
            <PercentInput bps={form.vatRateBps} onChange={(vatRateBps) => setForm({ ...form, vatRateBps })} />
          </label>
          <PricingRuleEditor value={form.pricingRule} onChange={(pricingRule) => setForm({ ...form, pricingRule })} />
          <div className="row">
            <label>
              Quantité d’aperçu
              <input type="number" min={0} step="any" value={previewQty} onChange={(e) => setPreviewQty(e.target.value)} />
            </label>
            <button type="button" className="secondary" onClick={computePreview}>Calculer</button>
            {preview !== null && <strong>{formatEuros(preview)} HT</strong>}
          </div>
          <label className="inline"><input type="checkbox" checked={form.vipOnly} onChange={(e) => setForm({ ...form, vipOnly: e.target.checked })} /> Réservée Explorator</label>
          <label className="inline"><input type="checkbox" checked={form.priorityAccess} onChange={(e) => setForm({ ...form, priorityAccess: e.target.checked })} /> Accès prioritaire</label>
          <label className="inline"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
          <div className="row">
            <button type="submit">{editingId ? 'Enregistrer' : 'Créer'}</button>
            {editingId && <button type="button" className="secondary" onClick={() => { setEditingId(null); setForm(EMPTY); }}>Annuler</button>}
          </div>
        </form>
      </div>
    </>
  );
}
