import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Property, PropertyStatus } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { EMPTY_PROPERTY, PropertyForm, formToBody, propertyToForm, type PropertyFormState } from '../components/PropertyForm';
import { PropertyPhotos } from '../components/PropertyPhotos';
import { formatEuros } from '../lib/money';

const STATUS_LABELS: Record<PropertyStatus, string> = { draft: 'Brouillon', pending: 'À valider', published: 'Publié', rejected: 'Rejeté' };

export function PropertiesPage() {
  const { token } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [form, setForm] = useState<PropertyFormState>(EMPTY_PROPERTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function showError(err: unknown) {
    setError(err instanceof Error ? err.message : 'Erreur');
  }

  function load() {
    api<Property[]>('/admin/properties', { token }).then(setProperties).catch(showError);
  }

  useEffect(load, [token]);

  async function submit() {
    setError(null);
    try {
      if (editingId) {
        await api('/admin/properties/' + editingId, { method: 'PATCH', body: formToBody(form), token });
      } else {
        await api('/admin/properties', { method: 'POST', body: formToBody(form), token });
      }
      reset();
      load();
    } catch (err) {
      showError(err);
    }
  }

  function reset() {
    setForm(EMPTY_PROPERTY);
    setEditingId(null);
  }

  async function setStatus(id: string, status: PropertyStatus) {
    const rejectionReason = status === 'rejected' ? (window.prompt('Motif du rejet') ?? '') : undefined;
    try {
      await api('/admin/properties/' + id + '/status', { method: 'PATCH', body: { status, rejectionReason }, token });
      load();
    } catch (err) {
      showError(err);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Supprimer ce bien ?')) return;
    try {
      await api('/admin/properties/' + id, { method: 'DELETE', token });
      load();
    } catch (err) {
      showError(err);
    }
  }

  return (
    <>
      <h1>Biens</h1>
      {error && <p className="error">{error}</p>}
      <div className="two-columns">
        <table>
          <thead>
            <tr><th>Titre</th><th>Arr.</th><th>Cap.</th><th>Nuitée HT</th><th>Photos</th><th>Statut</th><th></th></tr>
          </thead>
          <tbody>
            {properties.map((p) => (
              <tr key={p.id}>
                <td>{p.title}</td>
                <td>{p.address.arrondissement}e</td>
                <td>{p.capacity}</td>
                <td>{formatEuros(p.nightlyRateHtCents)}</td>
                <td><PropertyPhotos property={p} onChange={(updated) => setProperties(properties.map((item) => (item.id === updated.id ? updated : item)))} onError={setError} /></td>
                <td>
                  <span className={'badge ' + p.status}>{STATUS_LABELS[p.status]}</span>
                  {p.rejectionReason && <div className="muted">{p.rejectionReason}</div>}
                </td>
                <td className="row">
                  {p.status !== 'published' && <button type="button" className="small" onClick={() => setStatus(p.id, 'published')}>Publier</button>}
                  {p.status !== 'rejected' && <button type="button" className="danger small" onClick={() => setStatus(p.id, 'rejected')}>Rejeter</button>}
                  {p.status !== 'pending' && <button type="button" className="secondary small" onClick={() => setStatus(p.id, 'pending')}>En attente</button>}
                  <button type="button" className="secondary small" onClick={() => { setEditingId(p.id); setForm(propertyToForm(p)); }}>Modifier</button>
                  <button type="button" className="secondary small" onClick={() => remove(p.id)}>Supprimer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <PropertyForm form={form} onChange={setForm} onSubmit={submit} editing={editingId !== null} onCancel={reset} />
      </div>
    </>
  );
}
