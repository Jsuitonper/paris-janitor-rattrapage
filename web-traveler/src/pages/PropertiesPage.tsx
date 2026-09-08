import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Property } from '../api/types';
import { formatEuros } from '../lib/money';

export function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [arrondissement, setArrondissement] = useState('');
  const [capacity, setCapacity] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (arrondissement) params.set('arrondissement', arrondissement);
    if (capacity) params.set('capacity', capacity);
    const query = params.toString();
    api<Property[]>('/catalog/properties' + (query ? '?' + query : ''))
      .then(setProperties)
      .catch((err) => setError(err instanceof Error ? err.message : 'Chargement impossible'));
  }, [arrondissement, capacity]);

  return (
    <>
      <h1>Logements à Paris</h1>
      <div className="row">
        <label>
          Arrondissement
          <select value={arrondissement} onChange={(e) => setArrondissement(e.target.value)}>
            <option value="">Tous</option>
            {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}e
              </option>
            ))}
          </select>
        </label>
        <label>
          Voyageurs
          <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="1" />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      {properties.length === 0 && <p className="muted">Aucun logement disponible pour ces critères.</p>}
      <div className="cards">
        {properties.map((p) => (
          <article className="card" key={p.id}>
            <h3>
              <Link to={'/properties/' + p.id}>{p.title}</Link>
            </h3>
            <span className="muted">
              Paris {p.address.arrondissement}e · {p.capacity} voyageurs · {p.surfaceM2} m²
            </span>
            <strong>{formatEuros(p.nightlyRateHtCents)} HT / nuit</strong>
          </article>
        ))}
      </div>
    </>
  );
}
