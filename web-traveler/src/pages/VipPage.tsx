import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { VipPlan } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { formatEuros } from '../lib/money';

const LABELS = { free: 'Free', bagpacker: 'Bag Packer', explorator: 'Explorator' };

type PaidTier = 'bagpacker' | 'explorator';

function quotaLabel(plan: VipPlan): string {
  if (!plan.freeQuota) return 'Pas de prestation offerte';
  const cap = plan.freeQuota.maxAmountTtcCents ? ' (montant inférieur à ' + formatEuros(plan.freeQuota.maxAmountTtcCents) + ' TTC)' : ', sans limite de montant';
  return '1 prestation offerte tous les ' + plan.freeQuota.windowMonths + ' mois' + cap;
}

export function VipPage() {
  const { user, token } = useAuth();
  const [params] = useSearchParams();
  const [plans, setPlans] = useState<VipPlan[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<VipPlan[]>('/catalog/vip-plans').then(setPlans).catch((err) => setError(err.message));
  }, []);

  async function subscribe(tier: PaidTier, interval: 'monthly' | 'yearly') {
    setError(null);
    try {
      const { url } = await api<{ url: string }>('/subscription/checkout', { method: 'POST', token, body: { tier, interval } });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Souscription impossible');
    }
  }

  return (
    <>
      <h1>Formules VIP</h1>
      {params.get('checkout') === 'cancelled' && <p className="muted">Paiement annulé, aucune souscription enregistrée.</p>}
      {error && <p className="error">{error}</p>}
      <div className="cards">
        {plans.map((plan) => (
          <article className="card" key={plan.tier}>
            <h3>{LABELS[plan.tier]}</h3>
            <strong>{plan.monthlyPriceCents === 0 ? 'Gratuit' : formatEuros(plan.monthlyPriceCents) + ' / mois ou ' + formatEuros(plan.yearlyPriceCents) + ' / an'}</strong>
            <ul>
              <li>{plan.showAds ? 'Publicités affichées' : 'Sans publicité'}</li>
              <li>Commenter et publier des avis</li>
              <li>{plan.discountBps > 0 ? 'Remise permanente de ' + plan.discountBps / 100 + ' % sur les prestations' : 'Pas de remise permanente'}</li>
              <li>{quotaLabel(plan)}</li>
              <li>{plan.priorityAccess ? 'Accès prioritaire et prestations VIP' : 'Catalogue standard'}</li>
              {plan.renewalBonusBps > 0 && <li>−{plan.renewalBonusBps / 100} % au renouvellement du tarif annuel</li>}
            </ul>
            {plan.tier !== 'free' && !user && (
              <span className="muted"><Link to="/login">Connectez-vous</Link> pour souscrire.</span>
            )}
            {plan.tier !== 'free' && user && user.vip.tier === plan.tier && user.vip.status === 'active' && <span className="muted">Votre formule actuelle</span>}
            {plan.tier !== 'free' && user && !(user.vip.tier === plan.tier && user.vip.status === 'active') && (
              <div className="row">
                <button type="button" onClick={() => subscribe(plan.tier as PaidTier, 'monthly')}>Mensuel</button>
                <button type="button" className="secondary" onClick={() => subscribe(plan.tier as PaidTier, 'yearly')}>Annuel</button>
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
