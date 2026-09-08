import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAdmin, makeExplorator, registerTraveler, seedCatalog, startTestApp, type CatalogFixtures, type TestApp } from './setup';
import { signedWebhook, stripeEvent } from './stripeHelpers';

function intentObject(id: string, metadata: Record<string, string>, amount: number, extra: object = {}) {
  return { id, object: 'payment_intent', amount, currency: 'eur', status: 'succeeded', metadata, ...extra };
}

describe('paiement à l’acte : PaymentIntent et webhooks', () => {
  let ctx: TestApp;
  let fx: CatalogFixtures;
  let lea: { Authorization: string };
  let leaId: string;
  let stayId: string;
  let stayTotal: number;
  let serviceId: string;
  let serviceTotal: number;
  const scheduledAt = '2026-10-02T10:00:00.000Z';

  beforeAll(async () => {
    ctx = await startTestApp();
    fx = await seedCatalog(ctx.app, await createAdmin(ctx.app));
    const registered = await registerTraveler(ctx.app, 'lea@test.fr');
    lea = { Authorization: 'Bearer ' + registered.token };
    leaId = registered.user.id;
    const stay = await request(ctx.app).post('/api/bookings/stays').set(lea).send({ propertyId: fx.propertyId, startDate: '2026-10-01', endDate: '2026-10-04', guests: 2 });
    stayId = stay.body.id;
    stayTotal = stay.body.pricing.totalTtcCents;
    const service = await request(ctx.app).post('/api/bookings/services').set(lea).send({ offeringId: fx.taxiOfferingId, qty: 5, scheduledAt });
    serviceId = service.body.id;
    serviceTotal = service.body.pricing.totalTtcCents;
  });

  afterAll(() => ctx.stop());

  const stayRef = () => ({ bookingKind: 'stay', bookingId: stayId, userId: leaId });
  const serviceRef = () => ({ bookingKind: 'service', bookingId: serviceId, userId: leaId });
  const paymentStatusOf = async (kind: string, id: string) => (await request(ctx.app).get('/api/bookings/' + kind + '/' + id).set(lea)).body.paymentStatus;
  const myPayments = async () => (await request(ctx.app).get('/api/payments').set(lea)).body;

  it('une prestation offerte est payée à la création, sans PaymentIntent', async () => {
    const vip = await registerTraveler(ctx.app, 'vip@test.fr');
    await makeExplorator(vip.user.id);
    const auth = { Authorization: 'Bearer ' + vip.token };
    const booking = await request(ctx.app).post('/api/bookings/services').set(auth).send({ offeringId: fx.fixedOfferingId, qty: 1, scheduledAt });
    expect(booking.status).toBe(201);
    expect(booking.body.pricing.totalTtcCents).toBe(0);
    expect(booking.body.paymentStatus).toBe('paid');
    const intent = await request(ctx.app).post('/api/payments/intent').set(auth).send({ kind: 'service', bookingId: booking.body.id });
    expect(intent.status).toBe(409);
    expect(intent.body.error.code).toBe('NOTHING_TO_PAY');
  });

  it('une réservation à régler reste pending et un PaymentIntent exige Stripe', async () => {
    expect(await paymentStatusOf('stays', stayId)).toBe('pending');
    expect(stayTotal).toBe(39600);
    const intent = await request(ctx.app).post('/api/payments/intent').set(lea).send({ kind: 'stay', bookingId: stayId });
    expect(intent.status).toBe(503);
    expect(intent.body.error.code).toBe('STRIPE_NOT_CONFIGURED');
  });

  it('un voyageur ne peut pas régler la réservation d’un autre', async () => {
    const other = await registerTraveler(ctx.app, 'autre@test.fr');
    const intent = await request(ctx.app).post('/api/payments/intent').set('Authorization', 'Bearer ' + other.token).send({ kind: 'stay', bookingId: stayId });
    expect(intent.status).toBe(403);
  });

  it('payment_intent.succeeded au montant du snapshot passe la réservation en paid et enregistre le règlement', async () => {
    const response = await signedWebhook(ctx.app, stripeEvent('evt_pi_1', 'payment_intent.succeeded', intentObject('pi_stay', stayRef(), stayTotal)));
    expect(response.body).toEqual({ received: true, duplicate: false, handled: true });
    expect(await paymentStatusOf('stays', stayId)).toBe('paid');
    const payments = await myPayments();
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ paymentIntentId: 'pi_stay', status: 'succeeded', amountCents: stayTotal, bookingKind: 'stay', bookingId: stayId });
    const again = await request(ctx.app).post('/api/payments/intent').set(lea).send({ kind: 'stay', bookingId: stayId });
    expect(again.body.error.code).toBe('ALREADY_PAID');
  });

  it('rejouer le même événement de paiement est ignoré', async () => {
    const replay = await signedWebhook(ctx.app, stripeEvent('evt_pi_1', 'payment_intent.succeeded', intentObject('pi_stay', stayRef(), stayTotal)));
    expect(replay.body.duplicate).toBe(true);
    expect(await myPayments()).toHaveLength(1);
  });

  it('un montant différent du snapshot ne passe jamais la réservation en paid', async () => {
    await signedWebhook(ctx.app, stripeEvent('evt_pi_2', 'payment_intent.succeeded', intentObject('pi_service', serviceRef(), serviceTotal - 1)));
    expect(await paymentStatusOf('services', serviceId)).toBe('pending');
    const mismatch = (await myPayments()).find((p: { paymentIntentId: string }) => p.paymentIntentId === 'pi_service');
    expect(mismatch.status).toBe('amount_mismatch');
    expect(mismatch.lastError).toContain(String(serviceTotal));
  });

  it('payment_intent.payment_failed passe en payment_failed, puis un succès au bon montant repasse en paid', async () => {
    await signedWebhook(ctx.app, stripeEvent('evt_pi_3', 'payment_intent.payment_failed', intentObject('pi_service', serviceRef(), serviceTotal, { status: 'requires_payment_method', last_payment_error: { message: 'Your card was declined.' } })));
    expect(await paymentStatusOf('services', serviceId)).toBe('payment_failed');
    const failed = (await myPayments()).find((p: { paymentIntentId: string }) => p.paymentIntentId === 'pi_service');
    expect(failed).toMatchObject({ status: 'failed', lastError: 'Your card was declined.' });

    await signedWebhook(ctx.app, stripeEvent('evt_pi_4', 'payment_intent.succeeded', intentObject('pi_service', serviceRef(), serviceTotal)));
    expect(await paymentStatusOf('services', serviceId)).toBe('paid');
    expect((await myPayments()).find((p: { paymentIntentId: string }) => p.paymentIntentId === 'pi_service').status).toBe('succeeded');
  });

  it('payment_intent.canceled sur une réservation impayée la passe en payment_failed avec un motif', async () => {
    const stay = await request(ctx.app).post('/api/bookings/stays').set(lea).send({ propertyId: fx.propertyId, startDate: '2026-11-01', endDate: '2026-11-03', guests: 1 });
    const ref = { bookingKind: 'stay', bookingId: stay.body.id, userId: leaId };
    await signedWebhook(ctx.app, stripeEvent('evt_pi_6', 'payment_intent.canceled', intentObject('pi_cancel', ref, stay.body.pricing.totalTtcCents, { status: 'canceled' })));
    expect(await paymentStatusOf('stays', stay.body.id)).toBe('payment_failed');
    expect((await myPayments()).find((p: { paymentIntentId: string }) => p.paymentIntentId === 'pi_cancel')).toMatchObject({ status: 'failed', lastError: 'Paiement annulé' });
  });

  it('un PaymentIntent sans métadonnées de réservation (facture d’abonnement) est ignoré sans erreur', async () => {
    const response = await signedWebhook(ctx.app, stripeEvent('evt_pi_5', 'payment_intent.succeeded', intentObject('pi_sub', {}, 22000)));
    expect(response.body).toEqual({ received: true, duplicate: false, handled: true });
    expect((await myPayments()).map((p: { paymentIntentId: string }) => p.paymentIntentId)).not.toContain('pi_sub');
  });
});
