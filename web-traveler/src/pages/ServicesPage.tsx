import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { PricingSnapshot, ServiceCategory, ServiceOffering } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { PriceBreakdown } from '../components/PriceBreakdown';
import { formatEuros } from '../lib/money';

const UNIT_LABELS: Record<string, string> = { fixed: 'forfait', km: 'km', hour: 'heure', m2: 'm²', item: 'unité', night: 'nuit' };

function OfferingCard({ offering, category, onBooked }: { offering: ServiceOffering; category?: ServiceCategory; onBooked: () => void }) {
  const { user, token } = useAuth();
  const [qty, setQty] = useState(1);
  const [scheduledAt, setScheduledAt] = useState('');
  const [quote, setQuote] = useState<PricingSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isFixed = offering.pricingRule.unit === 'fixed';

  useEffect(() => {
    setQuote(null);
    if (!token || !scheduledAt || qty <= 0) return;
    api<PricingSnapshot>('/quotes/preview', { method: 'POST', token, body: { kind: 'service', service: { offeringId: offering.id, qty, scheduledAt: new Date(scheduledAt).toISOString() } } })
      .then((pricing) => { setQuote(pricing); setError(null); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Estimation impossible'));
  }, [token, offering.id, qty, scheduledAt]);

  async function book() {
    setError(null);
    try {
      await api('/bookings/services', { method: 'POST', token, body: { offeringId: offering.id, qty, scheduledAt: new Date(scheduledAt).toISOString() } });
      onBooked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Réservation impossible');
    }
  }

  return (
    <article className="card">
      <h3>{offering.name}</h3>
      <span className="muted">{category?.name}{offering.vipOnly && ' · réservée Explorator'}</span>
      <p>{offering.description}</p>
      <span>
        {isFixed
          ? formatEuros(offering.pricingRule.baseCents) + ' HT'
          : 'à partir de ' + formatEuros(offering.pricingRule.tiers[0].unitPriceCents) + ' HT / ' + UNIT_LABELS[offering.pricingRule.unit]}
      </span>
      {user ? (
        <>
          <div className="row">
            {!isFixed && (
              <label>
                Quantité ({UNIT_LABELS[offering.pricingRule.unit]})
                <input type="number" min={0} step="any" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
              </label>
            )}
            <label>
              Date
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          {quote && (
            <>
              <PriceBreakdown pricing={quote} />
              <button type="button" onClick={book}>Réserver</button>
            </>
          )}
        </>
      ) : (
        <span className="muted"><Link to="/login">Connectez-vous</Link> pour réserver.</span>
      )}
    </article>
  );
}

export function ServicesPage() {
  const { token } = useAuth();
  const [offerings, setOfferings] = useState<ServiceOffering[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api<ServiceOffering[]>('/catalog/offerings', { token }).then(setOfferings).catch(() => setOfferings([]));
    api<ServiceCategory[]>('/catalog/categories').then(setCategories).catch(() => setCategories([]));
  }, [token]);

  return (
    <>
      <h1>Prestations</h1>
      {message && <p className="muted">{message}</p>}
      <div className="cards">
        {offerings.map((o) => (
          <OfferingCard key={o.id} offering={o} category={categories.find((c) => c.id === o.categoryId)} onBooked={() => setMessage('Réservation enregistrée, retrouvez-la dans « Mes réservations ».')} />
        ))}
      </div>
    </>
  );
}
