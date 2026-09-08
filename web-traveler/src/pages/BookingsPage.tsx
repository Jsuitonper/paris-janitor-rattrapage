import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Payment, Property, ServiceBooking, ServiceOffering, StayBooking } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { formatDate, formatEuros } from '../lib/money';

const STATUS_LABELS = { requested: 'Demandée', confirmed: 'Confirmée', completed: 'Réalisée', cancelled: 'Annulée' };
const PAYMENT_LABELS: Record<string, string> = { pending: 'à payer', paid: 'payée', payment_failed: 'paiement refusé' };
const INTENT_LABELS: Record<string, string> = { requires_payment_method: 'en attente', processing: 'en cours', succeeded: 'réussi', failed: 'refusé', amount_mismatch: 'montant incohérent' };

type Kind = 'stays' | 'services';

export function BookingsPage() {
  const { token } = useAuth();
  const [params] = useSearchParams();
  const [stays, setStays] = useState<StayBooking[]>([]);
  const [services, setServices] = useState<ServiceBooking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [offerings, setOfferings] = useState<ServiceOffering[]>([]);
  const [error, setError] = useState<string | null>(null);
  const returned = params.get('payment') === 'return';
  const redirectStatus = params.get('redirect_status');

  function load() {
    api<{ stays: StayBooking[]; services: ServiceBooking[] }>('/bookings', { token })
      .then((data) => { setStays(data.stays); setServices(data.services); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Chargement impossible'));
    api<Payment[]>('/payments', { token }).then(setPayments).catch(() => undefined);
  }

  useEffect(() => {
    load();
    api<Property[]>('/catalog/properties').then(setProperties).catch(() => undefined);
    api<ServiceOffering[]>('/catalog/offerings', { token }).then(setOfferings).catch(() => undefined);
    if (!returned) return;
    const timers = [2000, 5000, 10000].map((delay) => window.setTimeout(load, delay));
    return () => timers.forEach(window.clearTimeout);
  }, [token, returned]);

  async function cancel(kind: Kind, id: string) {
    if (!window.confirm('Annuler cette réservation ?')) return;
    try {
      await api('/bookings/' + kind + '/' + id + '/cancel', { method: 'POST', token });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Annulation impossible');
    }
  }

  const cancellable = (status: string) => status === 'requested' || status === 'confirmed';
  const payable = (b: { status: string; paymentStatus: string; pricing: { totalTtcCents: number } }) =>
    b.status !== 'cancelled' && b.paymentStatus !== 'paid' && b.pricing.totalTtcCents > 0;

  function actions(kind: Kind, b: StayBooking | ServiceBooking) {
    return (
      <span className="row">
        {payable(b) && <Link to={'/pay/' + (kind === 'stays' ? 'stay' : 'service') + '/' + b.id}><button type="button">Payer</button></Link>}
        {cancellable(b.status) && <button type="button" className="secondary" onClick={() => cancel(kind, b.id)}>Annuler</button>}
      </span>
    );
  }

  return (
    <>
      <h1>Mes réservations</h1>
      {returned && redirectStatus === 'succeeded' && <p className="muted">Paiement transmis à Stripe : la réservation passera en « payée » dans quelques secondes.</p>}
      {returned && redirectStatus && redirectStatus !== 'succeeded' && <p className="error">Le paiement n’a pas abouti ({redirectStatus}).</p>}
      {error && <p className="error">{error}</p>}
      <h2>Séjours</h2>
      {stays.length === 0 && <p className="muted">Aucun séjour.</p>}
      <table>
        <tbody>
          {stays.map((s) => (
            <tr key={s.id}>
              <td>{properties.find((p) => p.id === s.propertyId)?.title ?? 'Logement'}</td>
              <td>{formatDate(s.startDate)} → {formatDate(s.endDate)} · {s.nights} nuit(s)</td>
              <td><span className={'badge ' + s.status}>{STATUS_LABELS[s.status]}</span> <span className="muted">{PAYMENT_LABELS[s.paymentStatus]}</span></td>
              <td>{formatEuros(s.pricing.totalTtcCents)} TTC</td>
              <td>{actions('stays', s)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Prestations</h2>
      {services.length === 0 && <p className="muted">Aucune prestation.</p>}
      <table>
        <tbody>
          {services.map((s) => (
            <tr key={s.id}>
              <td><Link to={'/bookings/services/' + s.id}>{offerings.find((o) => o.id === s.offeringId)?.name ?? 'Prestation'}</Link></td>
              <td>{new Date(s.scheduledAt).toLocaleString('fr-FR')} · qté {s.qty}</td>
              <td><span className={'badge ' + s.status}>{STATUS_LABELS[s.status]}</span> <span className="muted">{s.pricing.freeQuotaUsed ? 'offerte' : PAYMENT_LABELS[s.paymentStatus]}</span></td>
              <td>{formatEuros(s.pricing.totalTtcCents)} TTC</td>
              <td>{actions('services', s)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Règlements</h2>
      {payments.length === 0 && <p className="muted">Aucun règlement.</p>}
      <table>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id}>
              <td>{new Date(p.createdAt).toLocaleString('fr-FR')}</td>
              <td>{p.bookingKind === 'stay' ? 'Séjour' : 'Prestation'}</td>
              <td>{formatEuros(p.amountCents)}</td>
              <td><span className={'badge ' + (p.status === 'succeeded' ? 'completed' : p.status === 'failed' ? 'cancelled' : '')}>{INTENT_LABELS[p.status]}</span>{p.lastError && <span className="muted"> · {p.lastError}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
