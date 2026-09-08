import { useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { Review } from '../api/types';
import { useAuth } from '../auth/AuthContext';

const MODERATION_LABELS: Record<Review['moderation'], string> = {
  pending: 'en attente de modération',
  approved: 'publié',
  rejected: 'refusé par la modération',
};

type Props = { bookingId: string; existing: Review | null; onSubmitted: (review: Review) => void };

export function ReviewForm({ bookingId, existing, onSubmitted }: Props) {
  const { token } = useAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSending(true);
    try {
      onSubmitted(await api<Review>('/reviews', { method: 'POST', token, body: { bookingId, rating, comment } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible');
    } finally {
      setSending(false);
    }
  }

  if (existing) {
    return (
      <section className="card">
        <h3>Mon évaluation</h3>
        <p className="stars">{'★'.repeat(existing.rating) + '☆'.repeat(5 - existing.rating)}</p>
        {existing.comment && <p>{existing.comment}</p>}
        <p className="muted">Statut : {MODERATION_LABELS[existing.moderation]}</p>
        {existing.moderationReason && <p className="muted">Motif : {existing.moderationReason}</p>}
      </section>
    );
  }

  return (
    <section className="card">
      <h3>Évaluer la prestation</h3>
      <form onSubmit={submit}>
        <div className="stars">
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} type="button" aria-label={value + ' étoile(s)'} onClick={() => setRating(value)}>
              {value <= rating ? '★' : '☆'}
            </button>
          ))}
        </div>
        <label>
          Commentaire
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Votre retour sur la prestation" />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={sending}>
          Publier mon avis
        </button>
        <p className="muted">Votre avis sera publié après vérification par la conciergerie.</p>
      </form>
    </section>
  );
}
