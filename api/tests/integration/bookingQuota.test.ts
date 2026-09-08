import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAdmin, makeExplorator, registerTraveler, seedCatalog, startTestApp, type CatalogFixtures, type TestApp } from './setup';

describe('quota VIP, prestations vipOnly et transitions', () => {
  let ctx: TestApp;
  let admin: { Authorization: string };
  let explorator: { Authorization: string };
  let free: { Authorization: string };
  let fx: CatalogFixtures;
  const scheduledAt = '2026-10-02T10:00:00.000Z';

  beforeAll(async () => {
    ctx = await startTestApp();
    const adminToken = await createAdmin(ctx.app);
    admin = { Authorization: 'Bearer ' + adminToken };
    fx = await seedCatalog(ctx.app, adminToken);
    const vip = await registerTraveler(ctx.app, 'vip@test.fr');
    await makeExplorator(vip.user.id, new Date('2026-01-15T00:00:00Z'));
    explorator = { Authorization: 'Bearer ' + vip.token };
    free = { Authorization: 'Bearer ' + (await registerTraveler(ctx.app, 'free@test.fr')).token };
  });

  afterAll(() => ctx.stop());

  async function completeSheetFor(bookingId: string) {
    const sheets = await request(ctx.app).get('/api/admin/interventions?status=prefilled').set(admin);
    const sheet = sheets.body.find((item: { bookingId: string }) => item.bookingId === bookingId);
    await request(ctx.app)
      .patch('/api/admin/interventions/' + sheet.id + '/complete')
      .set(admin)
      .send({ performedAt: '2026-10-02T12:00:00.000Z', durationMinutes: 45, workDone: 'Fait' });
  }

  function book(auth: { Authorization: string }, offeringId: string) {
    return request(ctx.app).post('/api/bookings/services').set(auth).send({ offeringId, qty: 1, scheduledAt });
  }

  it('la première prestation Explorator de la fenêtre est offerte, la suivante est remisée de 5 %', async () => {
    const first = await book(explorator, fx.fixedOfferingId);
    expect(first.status).toBe(201);
    expect(first.body.pricing.freeQuotaUsed).toBe(true);
    expect(first.body.pricing.totalTtcCents).toBe(0);
    expect(first.body.pricing.commissionBps).toBe(1100);
    expect(first.body.pricing.providerNetHtCents).toBe(5000 - 550);

    const second = await book(explorator, fx.fixedOfferingId);
    expect(second.status).toBe(201);
    expect(second.body.pricing.freeQuotaUsed).toBe(false);
    expect(second.body.pricing.discountBps).toBe(500);
    expect(second.body.pricing.travelerPaysHtCents).toBe(4750);

    const cancelled = await request(ctx.app).post('/api/bookings/services/' + first.body.id + '/cancel').set(explorator);
    expect(cancelled.body.status).toBe('cancelled');

    const third = await book(explorator, fx.fixedOfferingId);
    expect(third.body.pricing.freeQuotaUsed).toBe(true);
    expect(third.body.pricing.totalTtcCents).toBe(0);
  });

  it('une prestation vipOnly est refusée à un Free et acceptée à un Explorator', async () => {
    const refused = await book(free, fx.vipOfferingId);
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe('VIP_REQUIRED');
    expect((await book(explorator, fx.vipOfferingId)).status).toBe(201);
  });

  it('un Free paie plein tarif sans quota', async () => {
    const booking = await book(free, fx.fixedOfferingId);
    expect(booking.body.pricing).toMatchObject({ freeQuotaUsed: false, discountBps: 0, travelerPaysHtCents: 5000, totalTtcCents: 6000 });
  });

  it('transitions admin : requested → confirmed → completed, puis toute sortie de completed est refusée', async () => {
    const booking = await book(free, fx.fixedOfferingId);
    const url = '/api/admin/bookings/services/' + booking.body.id + '/status';
    expect((await request(ctx.app).patch(url).set(admin).send({ status: 'completed' })).status).toBe(409);
    expect((await request(ctx.app).patch(url).set(admin).send({ status: 'confirmed' })).body.status).toBe('confirmed');
    const withoutSheet = await request(ctx.app).patch(url).set(admin).send({ status: 'completed' });
    expect(withoutSheet.status).toBe(409);
    expect(withoutSheet.body.error.code).toBe('SHEET_REQUIRED');
    await completeSheetFor(booking.body.id);
    expect((await request(ctx.app).patch(url).set(admin).send({ status: 'completed' })).body.status).toBe('completed');
    const late = await request(ctx.app).patch(url).set(admin).send({ status: 'cancelled' });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('INVALID_TRANSITION');
    expect((await request(ctx.app).post('/api/bookings/services/' + booking.body.id + '/cancel').set(free)).status).toBe(409);
    expect((await request(ctx.app).get('/api/admin/bookings/services?status=completed').set(admin)).body).toHaveLength(1);
  });
});
