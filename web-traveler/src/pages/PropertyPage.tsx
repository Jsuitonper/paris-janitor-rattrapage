import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { API_URL, api } from '../api/client';
import type { PricingSnapshot, Property } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { PriceBreakdown } from '../components/PriceBreakdown';
import { formatDate, formatEuros } from '../lib/money';

export function PropertyPage() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property | null>(null);
  const [unavailable, setUnavailable] = useState<{ start: string; end: string }[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [guests, setGuests] = useState(1);
  const [quote, setQuote] = useState<PricingSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Property>('/catalog/properties/' + id).then(setProperty).catch((err) => setError(err.message));
    api<{ start: string; end: string }[]>('/catalog/properties/' + id + '/availability').then(setUnavailable).catch(() => undefined);
  }, [id]);

  useEffect(() => {
    setQuote(null);
    if (!token || !startDate || !endDate || endDate <= startDate) return;
    api<PricingSnapshot>('/quotes/preview', { method: 'POST', token, body: { kind: 'stay', stay: { propertyId: id, startDate, endDate, guests } } })
      .then((pricing) => { setQuote(pricing); setError(null); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Estimation impossible'));
  }, [id, token, startDate, endDate, guests]);

  async function book() {
    setError(null);
    try {
      await api('/bookings/stays', { method: 'POST', token, body: { propertyId: id, startDate, endDate, guests } });
      navigate('/bookings');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Réservation impossible');
    }
  }

  if (!property) {
    return <p className="muted">{error ?? 'Chargement…'}</p>;
  }

  return (
    <>
      <h1>{property.title}</h1>
      <p className="muted">
        {property.address.street}, {property.address.postalCode} Paris {property.address.arrondissement}e · {property.capacity} voyageurs · {property.bedrooms} chambre(s) · {property.surfaceM2} m²
      </p>
      {property.photoIds.length > 0 && (
        <div className="photos">
          {property.photoIds.map((photoId) => (
            <img key={photoId} src={API_URL + "/files/" + photoId} alt={property.title} />
          ))}
        </div>
      )}
      <p>{property.description}</p>
      {property.amenities.length > 0 && <p className="muted">Équipements : {property.amenities.join(', ')}</p>}
      <p>
        <strong>{formatEuros(property.nightlyRateHtCents)} HT / nuit</strong>
      </p>
      <section className="card">
        <h3>Réserver</h3>
        {unavailable.length > 0 && (
          <p className="muted">
            Indisponible : {unavailable.map((r) => formatDate(r.start) + ' → ' + formatDate(r.end)).join(' ; ')}
          </p>
        )}
        <div className="row">
          <label>
            Arrivée
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            Départ
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label>
            Voyageurs
            <input type="number" min={1} max={property.capacity} value={guests} onChange={(e) => setGuests(Number(e.target.value))} />
          </label>
        </div>
        {!user && (
          <p className="muted">
            <Link to="/login">Connectez-vous</Link> pour obtenir une estimation et réserver.
          </p>
        )}
        {error && <p className="error">{error}</p>}
        {quote && (
          <>
            <PriceBreakdown pricing={quote} />
            <button type="button" onClick={book}>
              Réserver {quote.qty} nuit(s)
            </button>
          </>
        )}
      </section>
    </>
  );
}
