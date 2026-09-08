import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { ServiceCategory } from '../api/types';
import { useAuth } from '../auth/AuthContext';

const EMPTY = { name: '', slug: '', description: '' };

export function CategoriesPage() {
  const { token } = useAuth();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function showError(err: unknown) {
    setError(err instanceof Error ? err.message : 'Erreur');
  }

  function load() {
    api<ServiceCategory[]>('/admin/categories', { token }).then(setCategories).catch(showError);
  }

  useEffect(load, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (editingId) {
        await api('/admin/categories/' + editingId, { method: 'PATCH', body: form, token });
      } else {
        await api('/admin/categories', { method: 'POST', body: form, token });
      }
      setForm(EMPTY);
      setEditingId(null);
      load();
    } catch (err) {
      showError(err);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Supprimer cette catégorie ?')) return;
    try {
      await api('/admin/categories/' + id, { method: 'DELETE', token });
      load();
    } catch (err) {
      showError(err);
    }
  }

  return (
    <>
      <h1>Catégories de prestations</h1>
      {error && <p className="error">{error}</p>}
      <div className="two-columns">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Slug</th>
              <th>Description</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>
                  <code>{c.slug}</code>
                </td>
                <td>{c.description}</td>
                <td className="row">
                  <button type="button" className="secondary small" onClick={() => { setEditingId(c.id); setForm({ name: c.name, slug: c.slug, description: c.description }); }}>
                    Modifier
                  </button>
                  <button type="button" className="danger small" onClick={() => remove(c.id)}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form className="card" onSubmit={submit}>
          <h2>{editingId ? 'Modifier' : 'Nouvelle catégorie'}</h2>
          <label>
            Nom
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Slug
            <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
          </label>
          <label>
            Description
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
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
