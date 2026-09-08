import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAdmin, registerTraveler, seedCatalog, startTestApp, type CatalogFixtures, type TestApp } from './setup';
import { samplePng } from './invoiceHelpers';

describe('fiches d’intervention', () => {
  let ctx: TestApp;
  let fx: CatalogFixtures;
  let admin: { Authorization: string };
  let lea: { Authorization: string };
  let bob: { Authorization: string };
  let bookingId: string;
  let sheetId: string;
  const scheduledAt = '2026-10-02T10:00:00.000Z';

  beforeAll(async () => {
    ctx = await startTestApp();
    const adminToken = await createAdmin(ctx.app);
    admin = { Authorization: 'Bearer ' + adminToken };
    fx = await seedCatalog(ctx.app, adminToken);
    lea = { Authorization: 'Bearer ' + (await registerTraveler(ctx.app, 'lea@test.fr')).token };
    bob = { Authorization: 'Bearer ' + (await registerTraveler(ctx.app, 'bob@test.fr')).token };
  });

  afterAll(() => ctx.stop());

  const statusUrl = () => '/api/admin/bookings/services/' + bookingId + '/status';

  it('confirmer une prestation crée une fiche pré-remplie depuis le snapshot', async () => {
    const booking = await request(ctx.app)
      .post('/api/bookings/services')
      .set(lea)
      .send({ offeringId: fx.taxiOfferingId, qty: 10.5, scheduledAt });
    bookingId = booking.body.id;

    expect((await request(ctx.app).get('/api/admin/interventions').set(admin)).body).toHaveLength(0);
    await request(ctx.app).patch(statusUrl()).set(admin).send({ status: 'confirmed' });

    const sheets = await request(ctx.app).get('/api/admin/interventions?status=prefilled').set(admin);
    expect(sheets.body).toHaveLength(1);
    const sheet = sheets.body[0];
    sheetId = sheet.id;
    expect(sheet.status).toBe('prefilled');
    expect(sheet.report).toBeNull();
    expect(sheet.bookingId).toBe(bookingId);
    expect(sheet.prefill).toMatchObject({
      offeringName: 'Transfert aéroport',
      providerName: 'Taxi Paris',
      travelerName: 'Test Voyageur',
      qty: 10.5,
      unitLabel: 'km',
    });
    expect(new Date(sheet.prefill.scheduledAt).toISOString()).toBe(scheduledAt);
  });

  it('le voyageur ne voit rien tant que la fiche est pré-remplie', async () => {
    const early = await request(ctx.app).get('/api/interventions/' + bookingId).set(lea);
    expect(early.status).toBe(404);
    expect(early.body.error.code).toBe('SHEET_NOT_AVAILABLE');
    expect((await request(ctx.app).get('/api/interventions/' + bookingId).set(admin)).status).toBe(200);
  });

  it('clore la prestation sans fiche complétée est refusé', async () => {
    const refused = await request(ctx.app).patch(statusUrl()).set(admin).send({ status: 'completed' });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('SHEET_REQUIRED');
  });

  it('l’admin complète la fiche avec une pièce jointe, la prestation peut alors être close', async () => {
    const uploaded = await request(ctx.app)
      .post('/api/files')
      .set(admin)
      .field('kind', 'booking_attachment')
      .field('bookingId', bookingId)
      .attach('file', samplePng(), { filename: 'preuve.png', contentType: 'image/png' });
    expect(uploaded.status).toBe(201);

    const completed = await request(ctx.app)
      .patch('/api/admin/interventions/' + sheetId + '/complete')
      .set(admin)
      .send({
        performedAt: '2026-10-02T11:30:00.000Z',
        durationMinutes: 75,
        workDone: 'Transfert Roissy réalisé, 10,5 km parcourus',
        materialsUsed: 'Véhicule berline',
        incidents: 'Aucun',
        attachmentIds: [uploaded.body.id],
      });
    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe('completed');
    expect(completed.body.report.durationMinutes).toBe(75);
    expect(completed.body.report.attachmentIds).toEqual([uploaded.body.id]);
    expect(completed.body.completedAt).not.toBeNull();

    const closed = await request(ctx.app).patch(statusUrl()).set(admin).send({ status: 'completed' });
    expect(closed.body.status).toBe('completed');
  });

  it('le voyageur consulte la fiche complétée en lecture seule', async () => {
    const sheet = await request(ctx.app).get('/api/interventions/' + bookingId).set(lea);
    expect(sheet.status).toBe(200);
    expect(sheet.body.report.workDone).toContain('Transfert Roissy');
    expect(sheet.body.prefill.offeringName).toBe('Transfert aéroport');

    const write = await request(ctx.app)
      .patch('/api/admin/interventions/' + sheetId + '/complete')
      .set(lea)
      .send({ performedAt: scheduledAt, durationMinutes: 5, workDone: 'Tentative' });
    expect(write.status).toBe(403);
  });

  it('un voyageur ne lit pas la fiche d’une réservation qui n’est pas la sienne', async () => {
    const forbidden = await request(ctx.app).get('/api/interventions/' + bookingId).set(bob);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
  });

  it('annuler une prestation confirmée retire sa fiche', async () => {
    const booking = await request(ctx.app)
      .post('/api/bookings/services')
      .set(lea)
      .send({ offeringId: fx.fixedOfferingId, qty: 1, scheduledAt });
    const url = '/api/admin/bookings/services/' + booking.body.id + '/status';
    await request(ctx.app).patch(url).set(admin).send({ status: 'confirmed' });
    expect((await request(ctx.app).get('/api/interventions/' + booking.body.id).set(admin)).status).toBe(200);

    await request(ctx.app).patch(url).set(admin).send({ status: 'cancelled' });
    const gone = await request(ctx.app).get('/api/interventions/' + booking.body.id).set(admin);
    expect(gone.status).toBe(404);
    expect(gone.body.error.code).toBe('SHEET_NOT_FOUND');
  });
});
