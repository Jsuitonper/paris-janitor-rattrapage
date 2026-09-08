import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { formatEuros } from '../lib/money';

type Intent = { clientSecret: string; paymentIntentId: string; amountCents: number };

function CheckoutForm({ amountCents }: { amountCents: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setError(null);
    setSubmitting(true);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.origin + '/bookings?payment=return' },
    });
    if (result.error) {
      setError(result.error.message ?? 'Paiement refusé');
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={submit}>
      <PaymentElement />
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={!stripe || submitting}>
        Payer {formatEuros(amountCents)}
      </button>
    </form>
  );
}

export function PayPage() {
  const { kind, id } = useParams();
  const { token } = useAuth();
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef<string | null>(null);

  useEffect(() => {
    const key = kind + '/' + id;
    if (requested.current === key) return;
    requested.current = key;
    api<{ publishableKey: string }>('/payments/config', { token })
      .then((config) => setStripePromise(loadStripe(config.publishableKey)))
      .catch((err) => setError(err instanceof Error ? err.message : 'Paiement indisponible'));
    api<Intent>('/payments/intent', { method: 'POST', token, body: { kind, bookingId: id } })
      .then(setIntent)
      .catch((err) => setError(err instanceof Error ? err.message : 'Paiement indisponible'));
  }, [token, kind, id]);

  return (
    <>
      <h1>Régler ma réservation</h1>
      <p className="muted">
        <Link to="/bookings">← Mes réservations</Link>
      </p>
      {error && <p className="error">{error}</p>}
      {!error && (!stripePromise || !intent) && <p className="muted">Préparation du paiement…</p>}
      {stripePromise && intent && (
        <section className="card">
          <p>
            Montant : <strong>{formatEuros(intent.amountCents)} TTC</strong>
          </p>
          <Elements stripe={stripePromise} options={{ clientSecret: intent.clientSecret, locale: 'fr' }}>
            <CheckoutForm amountCents={intent.amountCents} />
          </Elements>
          <p className="muted">La réservation passera en « payée » dès confirmation par Stripe.</p>
        </section>
      )}
    </>
  );
}
