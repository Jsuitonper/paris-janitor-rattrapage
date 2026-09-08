import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { User } from '../api/types';
import { useAuth } from '../auth/AuthContext';

type Subscriber = User & {
  vip: User['vip'] & { stripeSubscriptionId: string | null; cancelAtPeriodEnd: boolean; interval: 'monthly' | 'yearly' | null; renewalBonusApplied: boolean };
};

const TIER_LABELS = { free: 'Free', bagpacker: 'Bag Packer', explorator: 'Explorator' };
const STATUS_LABELS: Record<string, string> = { none: '—', active: 'Actif', past_due: 'Impayé', canceled: 'Résilié' };
const date = (value: string | null) => (value ? new Date(value).toLocaleDateString('fr-FR') : '—');

export function SubscriptionsPage() {
  const { token } = useAuth();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Subscriber[]>('/admin/subscriptions', { token })
      .then(setSubscribers)
      .catch((err) => setError(err instanceof Error ? err.message : 'Chargement impossible'));
  }, [token]);

  return (
    <>
      <h1>Abonnés VIP</h1>
      <p className="muted">État projeté depuis les webhooks Stripe — aucune modification possible ici.</p>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr><th>E-mail</th><th>Formule</th><th>Statut</th><th>Cycle</th><th>Souscrit le</th><th>Échéance</th><th>Résiliation</th><th>Bonus renouv.</th><th>Abonnement Stripe</th></tr>
        </thead>
        <tbody>
          {subscribers.map((s) => (
            <tr key={s.id}>
              <td>{s.email}</td>
              <td>{TIER_LABELS[s.vip.tier]}</td>
              <td><span className={'badge ' + (s.vip.status === 'active' ? 'published' : s.vip.status === 'canceled' ? 'rejected' : 'pending')}>{STATUS_LABELS[s.vip.status]}</span></td>
              <td>{s.vip.interval === 'monthly' ? 'mensuel' : s.vip.interval === 'yearly' ? 'annuel' : '—'}</td>
              <td>{date(s.vip.anchorAt)}</td>
              <td>{date(s.vip.currentPeriodEnd)}</td>
              <td>{s.vip.cancelAtPeriodEnd ? 'programmée' : '—'}</td>
              <td>{s.vip.renewalBonusApplied ? 'appliqué' : '—'}</td>
              <td><code>{s.vip.stripeSubscriptionId ?? '—'}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
