import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAdmin, registerTraveler, seedCatalog, startTestApp, type CatalogFixtures, type TestApp } from './setup';
import { invoiceObject, signedWebhook, stripeEvent, subscriptionObject } from './stripeHelpers';

describe('webhooks Stripe : signature, projection, idempotence', () => {
  let ctx: TestApp;
  let fx: CatalogFixtures;
  let lea: { Authorization: string };
  let leaId: string;

  beforeAll(async () => {
    ctx = await startTestApp();
    fx = await seedCatalog(ctx.app, await createAdmin(ctx.app));
    const registered = await registerTraveler(ctx.app, 'lea@test.fr');
    lea = { Authorization: 'Bearer ' + registered.token };
    leaId = registered.user.id;
  });

  afterAll(() => ctx.stop());

  const me = async () => (await request(ctx.app).get('/api/me').set(lea)).body;
  const catalogNames = async () => (await request(ctx.app).get('/api/catalog/offerings').set(lea)).body.map((o: { name: string }) => o.name);
  const consumeQuota = () => request(ctx.app).post('/api/bookings/services').set(lea).send({ offeringId: fx.fixedOfferingId, qty: 1, scheduledAt: '2026-10-02T10:00:00.000Z' });
  const previewDiscount = async () =>
    (await request(ctx.app).post('/api/quotes/preview').set(lea).send({ kind: 'service', service: { offeringId: fx.taxiOfferingId, qty: 200, scheduledAt: '2026-10-02T10:00:00.000Z' } })).body.discountBps;

  it('rejette une signature invalide', async () => {
    const response = await signedWebhook(ctx.app, stripeEvent('evt_bad', 'invoice.paid', invoiceObject('in_0')), 'whsec_wrong');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('checkout.session.completed relie le client Stripe au compte', async () => {
    const session = { id: 'cs_1', object: 'checkout.session', mode: 'subscription', client_reference_id: leaId, customer: 'cus_lea' };
    const response = await signedWebhook(ctx.app, stripeEvent('evt_checkout', 'checkout.session.completed', session));
    expect(response.body).toEqual({ received: true, duplicate: false, handled: true });
    expect((await me()).stripeCustomerId).toBe('cus_lea');
  });

  it('customer.subscription.created projette Explorator actif, fixe anchorAt et active les avantages', async () => {
    expect(await previewDiscount()).toBe(0);
    await signedWebhook(ctx.app, stripeEvent('evt_sub_1', 'customer.subscription.created', subscriptionObject('price_explorator_yearly')));
    const user = await me();
    expect(user.vip).toMatchObject({ tier: 'explorator', status: 'active', interval: 'yearly', stripeSubscriptionId: 'sub_lea' });
    expect(user.vip.currentPeriodEnd).toBe(new Date(1800000000 * 1000).toISOString());
    expect(user.vip.anchorAt).not.toBeNull();
    expect(await previewDiscount()).toBe(10000);
    const offered = await consumeQuota();
    expect(offered.status).toBe(201);
    expect(offered.body.pricing.freeQuotaUsed).toBe(true);
    expect(await previewDiscount()).toBe(500);
    expect(await catalogNames()).toContain('Conciergerie privée');
  });

  it('rejouer le même event.id ne produit aucune mutation, même avec un corps différent', async () => {
    const replay = await signedWebhook(ctx.app, stripeEvent('evt_sub_1', 'customer.subscription.created', subscriptionObject('price_bagpacker_monthly')));
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual({ received: true, duplicate: true, handled: false });
    expect((await me()).vip.tier).toBe('explorator');
  });

  it('invoice.paid de création marque le bonus de renouvellement Explorator annuel', async () => {
    await signedWebhook(ctx.app, stripeEvent('evt_inv_1', 'invoice.paid', invoiceObject('in_1', 'subscription_create')));
    expect((await me()).vip.renewalBonusApplied).toBe(true);
  });

  it('aucune route applicative ne passe un utilisateur en VIP ; Checkout exige Stripe configuré', async () => {
    const other = await registerTraveler(ctx.app, 'free@test.fr');
    const checkout = await request(ctx.app).post('/api/subscription/checkout').set('Authorization', 'Bearer ' + other.token).send({ tier: 'explorator', interval: 'yearly' });
    expect(checkout.status).toBe(503);
    expect(checkout.body.error.code).toBe('STRIPE_NOT_CONFIGURED');
    expect((await request(ctx.app).get('/api/me').set('Authorization', 'Bearer ' + other.token)).body.vip.tier).toBe('free');
  });
});
