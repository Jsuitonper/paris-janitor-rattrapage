import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAdmin, registerTraveler, seedCatalog, startTestApp, type CatalogFixtures, type TestApp } from './setup';
import { invoiceObject, signedWebhook, stripeEvent, subscriptionObject } from './stripeHelpers';

describe('cycle de vie de l’abonnement piloté par les webhooks', () => {
  let ctx: TestApp;
  let fx: CatalogFixtures;
  let lea: { Authorization: string };
  let anchorAt: string;

  beforeAll(async () => {
    ctx = await startTestApp();
    fx = await seedCatalog(ctx.app, await createAdmin(ctx.app));
    const registered = await registerTraveler(ctx.app, 'lea@test.fr');
    lea = { Authorization: 'Bearer ' + registered.token };
    const session = { id: 'cs_1', object: 'checkout.session', mode: 'subscription', client_reference_id: registered.user.id, customer: 'cus_lea' };
    await signedWebhook(ctx.app, stripeEvent('evt_checkout', 'checkout.session.completed', session));
    await signedWebhook(ctx.app, stripeEvent('evt_sub_1', 'customer.subscription.created', subscriptionObject('price_explorator_yearly')));
    anchorAt = (await request(ctx.app).get('/api/me').set(lea)).body.vip.anchorAt;
    await consumeQuota();
  });

  afterAll(() => ctx.stop());

  const me = async () => (await request(ctx.app).get('/api/me').set(lea)).body;
  const catalogNames = async () => (await request(ctx.app).get('/api/catalog/offerings').set(lea)).body.map((o: { name: string }) => o.name);
  const consumeQuota = () => request(ctx.app).post('/api/bookings/services').set(lea).send({ offeringId: fx.fixedOfferingId, qty: 1, scheduledAt: '2026-10-02T10:00:00.000Z' });
  const previewDiscount = async () =>
    (await request(ctx.app).post('/api/quotes/preview').set(lea).send({ kind: 'service', service: { offeringId: fx.taxiOfferingId, qty: 200, scheduledAt: '2026-10-02T10:00:00.000Z' } })).body.discountBps;

  it('invoice.payment_failed suspend les avantages, invoice.paid les rétablit', async () => {
    await signedWebhook(ctx.app, stripeEvent('evt_inv_fail', 'invoice.payment_failed', invoiceObject('in_2')));
    expect((await me()).vip.status).toBe('past_due');
    expect(await catalogNames()).not.toContain('Conciergerie privée');
    expect(await previewDiscount()).toBe(0);
    await signedWebhook(ctx.app, stripeEvent('evt_inv_2', 'invoice.paid', invoiceObject('in_3', 'subscription_cycle')));
    expect((await me()).vip.status).toBe('active');
    expect(await previewDiscount()).toBe(500);
  });

  it('un changement de formule conserve anchorAt et le quota suit la nouvelle fenêtre', async () => {
    await signedWebhook(ctx.app, stripeEvent('evt_sub_2', 'customer.subscription.updated', subscriptionObject('price_bagpacker_monthly')));
    expect((await me()).vip).toMatchObject({ tier: 'bagpacker', interval: 'monthly', anchorAt });
    const view = await request(ctx.app).get('/api/subscription/me').set(lea);
    expect(view.body.effectiveTier).toBe('bagpacker');
    expect(view.body.quota).toMatchObject({ windowMonths: 12, windowIndex: 0, used: false, maxAmountTtcCents: 8000, start: anchorAt });
    expect(await previewDiscount()).toBe(0);
  });

  it('customer.subscription.deleted ramène en Free, retire les prestations vipOnly et conserve anchorAt', async () => {
    await signedWebhook(ctx.app, stripeEvent('evt_sub_3', 'customer.subscription.deleted', subscriptionObject('price_bagpacker_monthly', 'canceled')));
    expect((await me()).vip).toMatchObject({ tier: 'free', status: 'canceled', stripeSubscriptionId: null, anchorAt });
    expect(await catalogNames()).not.toContain('Conciergerie privée');
    expect((await request(ctx.app).get('/api/subscription/me').set(lea)).body.quota).toBeNull();
  });

  it('un type d’événement inconnu est accepté sans traitement', async () => {
    const response = await signedWebhook(ctx.app, stripeEvent('evt_other', 'charge.refunded', { id: 'ch_1', object: 'charge' }));
    expect(response.body).toEqual({ received: true, duplicate: false, handled: false });
  });
});
