import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { API_URL, api } from '../api/client';
import type { InterventionSheet, Review, ServiceBooking, ServiceOffering } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Conversation } from '../components/Conversation';
import { ReviewForm } from '../components/ReviewForm';
import { formatEuros } from '../lib/money';

const STATUS_LABELS = { requested: 'Demandée', confirmed: 'Confirmée', completed: 'Réalisée', cancelled: 'Annulée' };

export function ServiceBookingPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [booking, setBooking] = useState<ServiceBooking | null>(null);
  const [offering, setOffering] = useState<ServiceOffering | null>(null);
  const [sheet, setSheet] = useState<InterventionSheet | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<ServiceBooking>('/bookings/services/' + id, { token })
      .then((data) => {
        setBooking(data);
        api<ServiceOffering>('/catalog/offerings/' + data.offeringId, { token }).then(setOffering).catch(() => undefined);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Réservation introuvable'));
    api<InterventionSheet>('/interventions/' + id, { token })
      .then(setSheet)
      .catch(() => setSheet(null));
    api<Review[]>('/reviews', { token })
      .then((reviews) => setReview(reviews.find((item) => item.bookingId === id) ?? null))
      .catch(() => undefined);
  }, [id, token]);

  if (error) return <p className="error">{error}</p>;
  if (!booking) return <p className="muted">Chargement…</p>;

  return (
    <>
      <p className="muted">
        <Link to="/bookings">← Mes réservations</Link>
      </p>
      <h1>{offering?.name ?? 'Prestation'}</h1>
      <p>
        <span className={'badge ' + booking.status}>{STATUS_LABELS[booking.status]}</span>{' '}
        {new Date(booking.scheduledAt).toLocaleString('fr-FR')} · {booking.qty} · {formatEuros(booking.pricing.totalTtcCents)} TTC
      </p>

      <section className="card">
        <h3>Fiche d’intervention</h3>
        {!sheet && <p className="muted">La fiche sera disponible une fois la prestation réalisée par le prestataire.</p>}
        {sheet && sheet.report && (
          <>
            <dl className="sheet">
              <dt>Prestation</dt>
              <dd>{sheet.prefill.offeringName}</dd>
              <dt>Prestataire</dt>
              <dd>{sheet.prefill.providerName}</dd>
              {sheet.prefill.address && (
                <>
                  <dt>Adresse</dt>
                  <dd>{sheet.prefill.address}</dd>
                </>
              )}
              <dt>Réalisée le</dt>
              <dd>{new Date(sheet.report.performedAt).toLocaleString('fr-FR')}</dd>
              <dt>Durée</dt>
              <dd>{sheet.report.durationMinutes} minutes</dd>
              <dt>Travaux</dt>
              <dd>{sheet.report.workDone}</dd>
              {sheet.report.materialsUsed && (
                <>
                  <dt>Matériel</dt>
                  <dd>{sheet.report.materialsUsed}</dd>
                </>
              )}
              {sheet.report.incidents && (
                <>
                  <dt>Incidents</dt>
                  <dd>{sheet.report.incidents}</dd>
                </>
              )}
            </dl>
            {sheet.report.attachmentIds.length > 0 && (
              <div className="photos">
                {sheet.report.attachmentIds.map((fileId) => (
                  <img key={fileId} src={API_URL + '/files/' + fileId} alt="Pièce jointe" />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {booking.status === 'completed' ? (
        <ReviewForm bookingId={booking.id} existing={review} onSubmitted={setReview} />
      ) : (
        <section className="card">
          <h3>Évaluer la prestation</h3>
          <p className="muted">L’évaluation sera possible une fois la prestation réalisée.</p>
        </section>
      )}

      {booking.status !== 'cancelled' && <Conversation bookingId={booking.id} />}
    </>
  );
}
