import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { User } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { formatEuros } from '../lib/money';

type Payment = {
  id: string;
  paymentIntentId: string;
  bookingKind: 'stay' | 'service';
  bookingId: string;
  travelerId: string;
  amountCents: number;
  status: 'requires_payment_method' | 'processing' | 'succeeded' | 'failed' | 'amount_mismatch';
  lastError: string | null;
  createdAt: string;
};

const STATUS_LABELS: Record<Payment['status'], string> = { requires_payment_method: 'En attente', processing: 'En cours', succeeded: 'Réussi', failed: 'Refusé', amount_mismatch: 'Montant incohérent' };
const BADGE: Record<Payment['status'], string> = { requires_payment_method: 'pending', processing: 'pending', succeeded: 'published', failed: 'rejected', amount_mismatch: 'rejected' };

export function PaymentsPage() {
  const { token } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Payment[]>('/admin/payments', { token }).then(setPayments).catch((err) => setError(err instanceof Error ? err.message : 'Chargement impossible'));
    api<User[]>('/admin/users', { token }).then(setUsers).catch(() => undefined);
  }, [token]);

  return (
    <>
      <h1>Règlements</h1>
      <p className="muted">Statuts projetés depuis les webhooks payment_intent.* — le passage d’une réservation en « payée » ne se fait que par ce canal.</p>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr><th>Date</th><th>Voyageur</th><th>Type</th><th>Réservation</th><th>Montant</th><th>Statut</th><th>PaymentIntent</th></tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id}>
              <td>{new Date(p.createdAt).toLocaleString('fr-FR')}</td>
              <td>{users.find((u) => u.id === p.travelerId)?.email ?? p.travelerId}</td>
              <td>{p.bookingKind === 'stay' ? 'Séjour' : 'Prestation'}</td>
              <td><code>{p.bookingId}</code></td>
              <td>{formatEuros(p.amountCents)}</td>
              <td><span className={'badge ' + BADGE[p.status]}>{STATUS_LABELS[p.status]}</span>{p.lastError && <div className="muted">{p.lastError}</div>}</td>
              <td><code>{p.paymentIntentId}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
