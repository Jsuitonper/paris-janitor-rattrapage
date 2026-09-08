import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { Provider } from '../api/types';
import { useAuth } from '../auth/AuthContext';

const EMPTY = { name: '', job: '', email: '', phone: '', status: 'candidate' as Provider['status'] };
const STATUS_LABELS = { candidate: 'Candidat', validated: 'Validé', suspended: 'Suspendu' };

export function ProvidersPage() {
  const { token } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function showError(err: unknown) {
    setError(err instanceof Error ? err.message : 'Erreur');
  }

  function load() {
    api<Provider[]>('/admin/providers', { token }).then(setProviders).catch(showError);
  }

  useEffect(load, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const body = { ...form, phone: form.phone || null };
    try {
      if (editingId) {
        await api('/admin/providers/' + editingId, { method: 'PATCH', body, token });
      } else {
        await api('/admin/providers', { method: 'POST', body, token });
      }
      setForm(EMPTY);
      setEditingId(null);
      load();
    } catch (err) {
      showError(err);
    }
  }

  function edit(provider: Provider) {
    setEditingId(provider.id);
    setForm({ name: provider.name, job: provider.job, email: provider.email, phone: provider.phone ?? '', status: provider.status });
  }

  async function remove(id: string) {
    if (!window.confirm('Supprimer ce prestataire ?')) return;
    try {
      await api('/admin/providers/' + id, { method: 'DELETE', token });
      load();
    } catch (err) {
      showError(err);
    }
  }

  return (
    <>
      <h1>Prestataires</h1>
      {error && <p className="error">{error}</p>}
      <div className="two-columns">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Métier</th>
              <th>E-mail</th>
              <th>Statut</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.job}</td>
                <td>{p.email}</td>
                <td>
                  <span className="badge">{STATUS_LABELS[p.status]}</span>
                </td>
                <td>{p.ratingCount === 0 ? '—' : (p.ratingSum / p.ratingCount).toFixed(1) + ' / 5'}</td>
                <td className="row">
                  <button type="button" className="secondary small" onClick={() => edit(p)}>
                    Modifier
                  </button>
                  <button type="button" className="danger small" onClick={() => remove(p.id)}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form className="card" onSubmit={submit}>
          <h2>{editingId ? 'Modifier' : 'Nouveau prestataire'}</h2>
          <label>
            Nom
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Métier
            <input value={form.job} onChange={(e) => setForm({ ...form, job: e.target.value })} required />
          </label>
          <label>
            E-mail
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label>
            Téléphone
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label>
            Statut
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Provider['status'] })}>
              <option value="candidate">Candidat</option>
              <option value="validated">Validé</option>
              <option value="suspended">Suspendu</option>
            </select>
          </label>
          <div className="row">
            <button type="submit">{editingId ? 'Enregistrer' : 'Créer'}</button>
            {editingId && (
              <button type="button" className="secondary" onClick={() => { setEditingId(null); setForm(EMPTY); }}>
                Annuler
              </button>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
