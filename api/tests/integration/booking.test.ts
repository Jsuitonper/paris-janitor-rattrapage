import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAdmin, registerTraveler, seedCatalog, startTestApp, type CatalogFixtures, type TestApp } from './setup';

describe('réservations avec snapshot tarifaire', () => {
  let ctx: TestApp;
  let admin: { Authorization: string };
  let traveler: { Authorization: string };
  let fx: CatalogFixtures;
  let stayId: string;
  let serviceId: string;

  beforeAll(async () => {
    ctx = await startTestApp();
    const adminToken = await createAdmin(ctx.app);
    admin = { Authorization: 'Bearer ' + adminToken };
    traveler = { Authorization: 'Bearer ' + (await registerTraveler(ctx.app, 'lea@test.fr')).token };
    fx = await seedCatalog(ctx.app, adminToken);
  });

  afterAll(() => ctx.stop());

  it('séjour de 3 nuits : grossHt = 3 × tarif, commission plateforme 20 %', async () => {
    const response = await request(ctx.app)
      .post('/api/bookings/stays')
      .set(traveler)
      .send({ propertyId: fx.propertyId, startDate: '2026-10-01', endDate: '2026-10-04', guests: 2 });
    expect(response.status).toBe(201);
    stayId = response.body.id;
    expect(response.body.nights).toBe(3);
    expect(response.body.status).toBe('requested');
    expect(response.body.paymentStatus).toBe('pending');
    expect(response.body.pricing).toMatchObject({
      kind: 'stay',
      grossHtCents: 36000,
      commissionBps: 2000,
      commissionHtCents: 7200,
      providerNetHtCents: 28800,
      discountHtCents: 0,
      vatCents: 3600,
      totalTtcCents: 39600,
    });
  });

  it('prestation à paliers : le montant réservé est identique à l’estimation', async () => {
    const service = { offeringId: fx.taxiOfferingId, qty: 10.5, scheduledAt: '2026-10-02T10:00:00.000Z' };
    const preview = await request(ctx.app).post('/api/quotes/preview').set(traveler).send({ kind: 'service', service });
    expect(preview.status).toBe(200);
    expect(preview.body.grossHtCents).toBe(2075);

    const booking = await request(ctx.app).post('/api/bookings/services').set(traveler).send(service);
    expect(booking.status).toBe(201);
    serviceId = booking.body.id;
    expect(booking.body.pricing).toEqual(preview.body);
  });

  it('non-régression : modifier barème, pricingRule et commission séjour ne change aucun montant', async () => {
    const before = await request(ctx.app).get('/api/bookings').set(traveler);
    const stayBefore = before.body.stays.find((s: { id: string }) => s.id === stayId);
    const serviceBefore = before.body.services.find((s: { id: string }) => s.id === serviceId);

    expect((await request(ctx.app).put('/api/admin/pricing/commission-tiers').set(admin).send([{ upToCents: null, rateBps: 5000 }])).status).toBe(200);
    expect((await request(ctx.app).patch('/api/admin/offerings/' + fx.taxiOfferingId).set(admin).send({ pricingRule: { unit: 'km', baseCents: 99999, tiers: [{ upToQty: null, unitPriceCents: 999 }], minCents: 100 } })).status).toBe(200);
    expect((await request(ctx.app).patch('/api/admin/pricing/settings').set(admin).send({ stayCommissionBps: 5000 })).status).toBe(200);
    expect((await request(ctx.app).patch('/api/admin/properties/' + fx.propertyId).set(admin).send({ nightlyRateHtCents: 99900 })).status).toBe(200);

    const stayAfter = await request(ctx.app).get('/api/bookings/stays/' + stayId).set(traveler);
    const serviceAfter = await request(ctx.app).get('/api/bookings/services/' + serviceId).set(traveler);
    expect(stayAfter.body.pricing).toEqual(stayBefore.pricing);
    expect(serviceAfter.body.pricing).toEqual(serviceBefore.pricing);
    expect(stayAfter.body.pricing.grossHtCents).toBe(36000);
    expect(serviceAfter.body.pricing.grossHtCents).toBe(2075);

    const freshPreview = await request(ctx.app).post('/api/quotes/preview').set(traveler).send({ kind: 'service', service: { offeringId: fx.taxiOfferingId, qty: 10.5, scheduledAt: '2026-10-02T10:00:00.000Z' } });
    expect(freshPreview.body.grossHtCents).not.toBe(2075);
    expect(freshPreview.body.commissionBps).toBe(5000);
  });

  it('deux séjours qui se chevauchent : le second est refusé en 409 DATES_UNAVAILABLE', async () => {
    const overlapping = await request(ctx.app).post('/api/bookings/stays').set(traveler).send({ propertyId: fx.propertyId, startDate: '2026-10-03', endDate: '2026-10-06', guests: 1 });
    expect(overlapping.status).toBe(409);
    expect(overlapping.body.error.code).toBe('DATES_UNAVAILABLE');

    const adjacent = await request(ctx.app).post('/api/bookings/stays').set(traveler).send({ propertyId: fx.propertyId, startDate: '2026-10-04', endDate: '2026-10-06', guests: 1 });
    expect(adjacent.status).toBe(201);

    const availability = await request(ctx.app).get('/api/catalog/properties/' + fx.propertyId + '/availability');
    expect(availability.body).toHaveLength(2);
  });

  it('un voyageur ne lit que ses propres réservations', async () => {
    const other = { Authorization: 'Bearer ' + (await registerTraveler(ctx.app, 'autre@test.fr')).token };
    const forbidden = await request(ctx.app).get('/api/bookings/stays/' + stayId).set(other);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
    expect((await request(ctx.app).get('/api/bookings/services/' + serviceId).set(other)).status).toBe(403);
    expect((await request(ctx.app).get('/api/bookings/stays/' + stayId).set(admin)).status).toBe(200);
    expect((await request(ctx.app).get('/api/bookings').set(other)).body.stays).toHaveLength(0);
  });
});
