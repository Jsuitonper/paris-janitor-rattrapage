import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Provider, Review, ServiceOffering } from '../api/types';
import { useAuth } from '../auth/AuthContext';

const LABELS: Record<Review['moderation'], string> = { pending: 'En attente', approved: 'Publié', rejected: 'Refusé' };
const BADGES: Record<Review['moderation'], string> = { pending: 'pending', approved: 'published', rejected: 'rejected' };

export function ReviewsPage() {
  const { token } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [offerings, setOfferings] = useState<ServiceOffering[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | ''>('pending');
  const [error, setError] = useState<string | null>(null);

  function showError(err: unknown) {
    setError(err instanceof Error ? err.message : 'Erreur');
  }

  function load() {
    api<Review[]>('/admin/reviews' + (filter ? '?moderation=' + filter : ''), { token })
      .then(setReviews)
      .catch(showError);
    api<Provider[]>('/admin/providers', { token }).then(setProviders).catch(() => undefined);
  }

  useEffect(load, [token, filter]);

  useEffect(() => {
    api<ServiceOffering[]>('/admin/offerings', { token }).then(setOfferings).catch(() => undefined);
  }, [token]);

  async function moderate(review: Review, moderation: 'approved' | 'rejected') {
    setError(null);
    const moderationReason = moderation === 'rejected' ? (window.prompt('Motif du refus') ?? '') : null;
    try {
      await api('/admin/reviews/' + review.id + '/moderation', { method: 'PATCH', body: { moderation, moderationReason }, token });
      load();
    } catch (err) {
      showError(err);
    }
  }

  const provider = (id: string) => providers.find((p) => p.id === id);

  return (
    <>
      <h1>Modération des avis</h1>
      <p className="muted">Seuls les avis approuvés sont publics et comptent dans la note moyenne du prestataire.</p>
      {error && <p className="error">{error}</p>}

      <div className="row">
        <label>
          Filtrer
          <select value={filter} onChange={(e) => setFilter(e.target.value as 'pending' | 'approved' | 'rejected' | '')}>
            <option value="pending">En attente</option>
            <option value="approved">Publiés</option>
            <option value="rejected">Refusés</option>
            <option value="">Tous</option>
          </select>
        </label>
      </div>

      <table>
        <thead>
          <tr>
            <th>Déposé le</th>
            <th>Auteur</th>
            <th>Prestation</th>
            <th>Prestataire</th>
            <th>Note</th>
            <th>Commentaire</th>
            <th>Statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {reviews.map((review) => (
            <tr key={review.id}>
              <td>{new Date(review.createdAt).toLocaleDateString('fr-FR')}</td>
              <td>{review.authorName}</td>
              <td>{offerings.find((o) => o.id === review.offeringId)?.name ?? '—'}</td>
              <td>
                {provider(review.providerId)?.name ?? '—'}
                <div className="muted">
                  {(() => {
                    const p = provider(review.providerId);
                    return p && p.ratingCount > 0 ? (p.ratingSum / p.ratingCount).toFixed(1) + ' / 5 sur ' + p.ratingCount + ' avis' : 'aucun avis publié';
                  })()}
                </div>
              </td>
              <td>{'★'.repeat(review.rating) + '☆'.repeat(5 - review.rating)}</td>
              <td>{review.comment}</td>
              <td>
                <span className={'badge ' + BADGES[review.moderation]}>{LABELS[review.moderation]}</span>
                {review.moderationReason && <div className="muted">{review.moderationReason}</div>}
              </td>
              <td className="row">
                {review.moderation !== 'approved' && (
                  <button type="button" className="small" onClick={() => moderate(review, 'approved')}>
                    Publier
                  </button>
                )}
                {review.moderation !== 'rejected' && (
                  <button type="button" className="danger small" onClick={() => moderate(review, 'rejected')}>
                    Refuser
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
