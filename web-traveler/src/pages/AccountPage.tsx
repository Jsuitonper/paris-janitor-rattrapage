import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { SubscriptionView } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { formatDate, formatEuros } from '../lib/money';

const TIER_LABELS = { free: 'Free', bagpacker: 'Bag Packer', explorator: 'Explorator' };
const STATUS_LABELS: Record<string, string> = { none: 'aucun abonnement', active: 'actif', past_due: 'paiement en retard', canceled: 'résilié' };

export function AccountPage() {
  const { user, token } = useAuth();
  const [params] = useSearchParams();
  const [view, setView] = useState<SubscriptionView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SubscriptionView>('/subscription/me', { token }).then(setView).catch((err) => setError(err.message));
  }, [token]);

  async function openPortal() {
    try {
      const { url } = await api<{ url: string }>('/subscription/portal', { method: 'POST', token });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Portail indisponible');
    }
  }

  if (!user) return null;

  return (
    <>
      <h1>Bonjour {user.profile.firstName}</h1>
      <p>Connecté en tant que <strong>{user.email}</strong></p>
      {params.get('checkout') === 'success' && <p className="muted">Paiement reçu : votre formule sera activée dès confirmation par Stripe.</p>}
      {error && <p className="error">{error}</p>}
      {view && (
        <section className="card">
          <h3>Mon abonnement</h3>
          <p>
            Formule <strong>{TIER_LABELS[view.effectiveTier]}</strong> · {STATUS_LABELS[view.vip.status]}
            {view.vip.currentPeriodEnd && ' · échéance le ' + formatDate(view.vip.currentPeriodEnd)}
            {view.vip.cancelAtPeriodEnd && ' · résiliation programmée'}
          </p>
          {view.quota && (
            <p>
              Prestation offerte : {view.quota.used ? 'déjà utilisée' : 'disponible'} du {formatDate(view.quota.start)} au {formatDate(view.quota.end)}
              {view.quota.maxAmountTtcCents && ' (montant inférieur à ' + formatEuros(view.quota.maxAmountTtcCents) + ' TTC)'}
            </p>
          )}
          {view.vip.stripeSubscriptionId ? (
            <button type="button" onClick={openPortal}>Gérer mon abonnement</button>
          ) : (
            <Link to="/vip">Découvrir les formules VIP</Link>
          )}
        </section>
      )}
    </>
  );
}
