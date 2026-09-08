import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Property, ServiceOffering, User } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { formatEuros } from '../lib/money';

type Status = 'requested' | 'confirmed' | 'completed' | 'cancelled';
type Stay = { id: string; travelerId: string; propertyId: string; startDate: string; endDate: string; nights: number; status: Status; paymentStatus: string; pricing: { totalTtcCents: number; providerNetHtCents: number } };
type Service = { id: string; travelerId: string; offeringId: string; qty: number; scheduledAt: string; status: Status; paymentStatus: string; pricing: { totalTtcCents: number; providerNetHtCents: number; freeQuotaUsed: boolean } };

const NEXT: Record<Status, Status[]> = { requested: ['confirmed', 'cancelled'], confirmed: ['completed', 'cancelled'], completed: [], cancelled: [] };
const LABELS: Record<Status, string> = { requested: 'Demandée', confirmed: 'Confirmée', completed: 'Réalisée', cancelled: 'Annulée' };

export function BookingsPage() {
  const { token } = useAuth();
  const [stays, setStays] = useState<Stay[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [offerings, setOfferings] = useState<ServiceOffering[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api<Stay[]>('/admin/bookings/stays', { token }).then(setStays).catch((err) => setError(err.message));
    api<Service[]>('/admin/bookings/services', { token }).then(setServices).catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
    api<User[]>('/admin/users', { token }).then(setUsers).catch(() => undefined);
    api<Property[]>('/admin/properties', { token }).then(setProperties).catch(() => undefined);
    api<ServiceOffering[]>('/admin/offerings', { token }).then(setOfferings).catch(() => undefined);
  }, [token]);

  async function setStatus(kind: 'stays' | 'services', id: string, status: Status) {
    setError(null);
    try {
      await api('/admin/bookings/' + kind + '/' + id + '/status', { method: 'PATCH', body: { status }, token });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  const email = (id: string) => users.find((u) => u.id === id)?.email ?? id;

  function actions(kind: 'stays' | 'services', id: string, status: Status) {
    return NEXT[status].map((next) => (
      <button key={next} type="button" className={next === 'cancelled' ? 'danger small' : 'small'} onClick={() => setStatus(kind, id, next)}>
        {LABELS[next]}
      </button>
    ));
  }

  return (
    <>
      <h1>Réservations</h1>
      {error && <p className="error">{error}</p>}
      <h2>Séjours</h2>
      <table>
        <thead><tr><th>Voyageur</th><th>Bien</th><th>Dates</th><th>Statut</th><th>Paiement</th><th>TTC</th><th>Net bailleur HT</th><th></th></tr></thead>
        <tbody>
          {stays.map((s) => (
            <tr key={s.id}>
              <td>{email(s.travelerId)}</td>
              <td>{properties.find((p) => p.id === s.propertyId)?.title ?? s.propertyId}</td>
              <td>{s.startDate.slice(0, 10)} → {s.endDate.slice(0, 10)} ({s.nights} n.)</td>
              <td><span className={'badge ' + s.status}>{LABELS[s.status]}</span></td>
              <td>{s.paymentStatus}</td>
              <td>{formatEuros(s.pricing.totalTtcCents)}</td>
              <td>{formatEuros(s.pricing.providerNetHtCents)}</td>
              <td className="row">{actions('stays', s.id, s.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Prestations</h2>
      <table>
        <thead><tr><th>Voyageur</th><th>Prestation</th><th>Date</th><th>Qté</th><th>Statut</th><th>Paiement</th><th>TTC</th><th>Net prestataire HT</th><th></th></tr></thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.id}>
              <td>{email(s.travelerId)}</td>
              <td>{offerings.find((o) => o.id === s.offeringId)?.name ?? s.offeringId}</td>
              <td>{new Date(s.scheduledAt).toLocaleString('fr-FR')}</td>
              <td>{s.qty}</td>
              <td><span className={'badge ' + s.status}>{LABELS[s.status]}</span></td>
              <td>{s.pricing.freeQuotaUsed ? 'offerte' : s.paymentStatus}</td>
              <td>{formatEuros(s.pricing.totalTtcCents)}</td>
              <td>{formatEuros(s.pricing.providerNetHtCents)}</td>
              <td className="row">{actions('services', s.id, s.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
