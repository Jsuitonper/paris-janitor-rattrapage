import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAdmin, registerTraveler, seedCatalog, startTestApp, type CatalogFixtures, type TestApp } from './setup';

type Call = { method: 'get' | 'post' | 'patch' | 'put' | 'delete'; path: string; body?: object };

describe('cloisonnement des accès', () => {
  let ctx: TestApp;
  let fx: CatalogFixtures;
  let travelerToken: string;
  let otherToken: string;
  let ownBookingId: string;

  beforeAll(async () => {
    ctx = await startTestApp();
    const adminToken = await createAdmin(ctx.app);
    fx = await seedCatalog(ctx.app, adminToken);
    const lea = await registerTraveler(ctx.app, 'lea@test.fr');
    travelerToken = lea.token;
    otherToken = (await registerTraveler(ctx.app, 'bob@test.fr')).token;

    const booking = await request(ctx.app)
      .post('/api/bookings/services')
      .set('Authorization', 'Bearer ' + travelerToken)
      .send({ offeringId: fx.taxiOfferingId, qty: 5, scheduledAt: '2026-10-02T10:00:00.000Z' });
    ownBookingId = booking.body.id;
  });

  afterAll(() => ctx.stop());

  function send(call: Call, token?: string) {
    const req = request(ctx.app)[call.method]('/api' + call.path);
    if (token) req.set('Authorization', 'Bearer ' + token);
    return req.send(call.body ?? {});
  }

  const adminCalls = (): Call[] => [
    { method: 'get', path: '/admin/users' },
    { method: 'get', path: '/admin/providers' },
    { method: 'post', path: '/admin/providers', body: { name: 'X', job: 'Y', email: 'x@test.fr' } },
    { method: 'delete', path: '/admin/providers/' + fx.providerId },
    { method: 'get', path: '/admin/categories' },
    { method: 'post', path: '/admin/categories', body: { name: 'X', slug: 'x' } },
    { method: 'get', path: '/admin/offerings' },
    { method: 'delete', path: '/admin/offerings/' + fx.taxiOfferingId },
    { method: 'get', path: '/admin/properties' },
    { method: 'patch', path: '/admin/properties/' + fx.propertyId + '/status', body: { status: 'rejected' } },
    { method: 'post', path: '/admin/properties/' + fx.propertyId + '/photos' },
    { method: 'get', path: '/admin/pricing/commission-tiers' },
    { method: 'put', path: '/admin/pricing/commission-tiers', body: [{ upToCents: null, rateBps: 0 }] },
    { method: 'patch', path: '/admin/pricing/settings', body: { stayCommissionBps: 0 } },
    { method: 'patch', path: '/admin/pricing/vip-plans/explorator', body: { discountBps: 0 } },
    { method: 'get', path: '/admin/bookings/stays' },
    { method: 'get', path: '/admin/bookings/services' },
    { method: 'patch', path: '/admin/bookings/services/' + ownBookingId + '/status', body: { status: 'cancelled' } },
    { method: 'get', path: '/admin/subscriptions' },
    { method: 'get', path: '/admin/payments' },
    { method: 'get', path: '/admin/invoices' },
    { method: 'post', path: '/admin/invoices/provider-payouts', body: { year: 2026, month: 10 } },
    { method: 'get', path: '/admin/interventions' },
    { method: 'get', path: '/admin/reviews' },
    { method: 'get', path: '/admin/threads' },
    { method: 'get', path: '/admin/leads' },
    { method: 'get', path: '/admin/leads/export.csv' },
    { method: 'post', path: '/files' },
    { method: 'delete', path: '/files/000000000000000000000000' },
  ];

  const travelerCalls = (): Call[] => [
    { method: 'get', path: '/me' },
    { method: 'get', path: '/bookings' },
    { method: 'post', path: '/bookings/stays', body: {} },
    { method: 'post', path: '/bookings/services', body: {} },
    { method: 'post', path: '/quotes/preview', body: {} },
    { method: 'get', path: '/payments' },
    { method: 'get', path: '/payments/config' },
    { method: 'post', path: '/payments/intent', body: {} },
    { method: 'get', path: '/invoices' },
    { method: 'get', path: '/reviews' },
    { method: 'post', path: '/reviews', body: {} },
    { method: 'get', path: '/threads' },
    { method: 'get', path: '/subscription/me' },
    { method: 'post', path: '/subscription/checkout', body: {} },
    { method: 'post', path: '/subscription/portal' },
  ];

  it('toutes les routes d’administration refusent un anonyme en 401', async () => {
    for (const call of adminCalls()) {
      const response = await send(call);
      expect(response.status, call.method + ' ' + call.path).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('toutes les routes d’administration refusent un voyageur en 403', async () => {
    for (const call of adminCalls()) {
      const response = await send(call, travelerToken);
      expect(response.status, call.method + ' ' + call.path).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    }
  });

  it('toutes les routes voyageur refusent un anonyme en 401', async () => {
    for (const call of travelerCalls()) {
      const response = await send(call);
      expect(response.status, call.method + ' ' + call.path).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('un voyageur ne peut pas atteindre les ressources d’un autre', async () => {
    const foreign = { Authorization: 'Bearer ' + otherToken };
    expect((await request(ctx.app).get('/api/bookings/services/' + ownBookingId).set(foreign)).status).toBe(403);
    expect((await request(ctx.app).post('/api/bookings/services/' + ownBookingId + '/cancel').set(foreign)).status).toBe(403);
    expect((await request(ctx.app).get('/api/threads/' + ownBookingId).set(foreign)).status).toBe(403);
    expect((await request(ctx.app).post('/api/threads/' + ownBookingId + '/messages').set(foreign).send({ body: 'salut' })).status).toBe(403);
    expect((await request(ctx.app).get('/api/interventions/' + ownBookingId).set(foreign)).status).toBe(403);
    expect((await request(ctx.app).post('/api/reviews').set(foreign).send({ bookingId: ownBookingId, rating: 5 })).status).toBe(403);
    expect((await request(ctx.app).post('/api/payments/intent').set(foreign).send({ kind: 'service', bookingId: ownBookingId })).status).toBe(403);
  });

  it('une prestation ne peut pas être rattachée au séjour d’un autre voyageur', async () => {
    const stay = await request(ctx.app)
      .post('/api/bookings/stays')
      .set('Authorization', 'Bearer ' + travelerToken)
      .send({ propertyId: fx.propertyId, startDate: '2026-11-01', endDate: '2026-11-04', guests: 2 });
    expect(stay.status).toBe(201);

    const stolen = await request(ctx.app)
      .post('/api/bookings/services')
      .set('Authorization', 'Bearer ' + otherToken)
      .send({ offeringId: fx.taxiOfferingId, qty: 3, scheduledAt: '2026-11-02T10:00:00.000Z', stayBookingId: stay.body.id });
    expect(stolen.status).toBe(404);
    expect(stolen.body.error.code).toBe('STAY_NOT_FOUND');
  });

  it('les routes publiques restent ouvertes sans jeton', async () => {
    const open: Call[] = [
      { method: 'get', path: '/health' },
      { method: 'get', path: '/catalog/properties' },
      { method: 'get', path: '/catalog/properties/' + fx.propertyId },
      { method: 'get', path: '/catalog/categories' },
      { method: 'get', path: '/catalog/offerings' },
      { method: 'get', path: '/catalog/vip-plans' },
      { method: 'get', path: '/catalog/offerings/' + fx.taxiOfferingId + '/reviews' },
      { method: 'get', path: '/simulator/options' },
    ];
    for (const call of open) {
      const response = await send(call);
      expect(response.status, call.method + ' ' + call.path).toBe(200);
    }
  });
});
