import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAdmin, registerTraveler, seedCatalog, startTestApp, type CatalogFixtures, type TestApp } from './setup';
import { samplePng } from './invoiceHelpers';

const ABSENT = '000000000000000000000000';

describe('chemins d’erreur métier', () => {
  let ctx: TestApp;
  let fx: CatalogFixtures;
  let admin: { Authorization: string };
  let traveler: { Authorization: string };

  beforeAll(async () => {
    ctx = await startTestApp();
    const adminToken = await createAdmin(ctx.app);
    admin = { Authorization: 'Bearer ' + adminToken };
    fx = await seedCatalog(ctx.app, adminToken);
    traveler = { Authorization: 'Bearer ' + (await registerTraveler(ctx.app, 'lea@test.fr')).token };
  });

  afterAll(() => ctx.stop());

  it('les identifiants inconnus renvoient un 404 spécifique à la ressource', async () => {
    const cases: [string, string][] = [
      ['/api/catalog/properties/' + ABSENT, 'PROPERTY_NOT_FOUND'],
      ['/api/catalog/offerings/' + ABSENT, 'OFFERING_NOT_FOUND'],
      ['/api/admin/properties/' + ABSENT, 'PROPERTY_NOT_FOUND'],
      ['/api/admin/providers/' + ABSENT, 'PROVIDER_NOT_FOUND'],
      ['/api/admin/offerings/' + ABSENT, 'OFFERING_NOT_FOUND'],
      ['/api/bookings/stays/' + ABSENT, 'BOOKING_NOT_FOUND'],
      ['/api/bookings/services/' + ABSENT, 'BOOKING_NOT_FOUND'],
      ['/api/invoices/' + ABSENT, 'INVOICE_NOT_FOUND'],
      ['/api/files/' + ABSENT, 'FILE_NOT_FOUND'],
      ['/api/interventions/' + ABSENT, 'BOOKING_NOT_FOUND'],
      ['/api/threads/' + ABSENT, 'BOOKING_NOT_FOUND'],
    ];
    for (const [path, code] of cases) {
      const response = await request(ctx.app).get(path).set(path.includes('/admin/') ? admin : traveler);
      expect(response.status, path).toBe(404);
      expect(response.body.error.code, path).toBe(code);
    }
  });

  it('un identifiant mal formé est traité comme introuvable, pas comme une erreur serveur', async () => {
    const response = await request(ctx.app).get('/api/catalog/properties/pas-un-objectid');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PROPERTY_NOT_FOUND');
  });

  it('un séjour au-delà de la capacité du bien est refusé', async () => {
    const response = await request(ctx.app)
      .post('/api/bookings/stays')
      .set(traveler)
      .send({ propertyId: fx.propertyId, startDate: '2026-12-01', endDate: '2026-12-03', guests: 12 });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('CAPACITY_EXCEEDED');
  });

  it('des dates de séjour incohérentes sont refusées à la validation', async () => {
    const inverted = await request(ctx.app)
      .post('/api/bookings/stays')
      .set(traveler)
      .send({ propertyId: fx.propertyId, startDate: '2026-12-05', endDate: '2026-12-01', guests: 1 });
    expect(inverted.status).toBe(400);
    expect(inverted.body.error.code).toBe('VALIDATION_ERROR');

    const sameDay = await request(ctx.app)
      .post('/api/bookings/stays')
      .set(traveler)
      .send({ propertyId: fx.propertyId, startDate: '2026-12-05', endDate: '2026-12-05', guests: 1 });
    expect(sameDay.status).toBe(400);
  });

  it('un bien non publié n’est pas réservable', async () => {
    const draft = await request(ctx.app)
      .post('/api/admin/properties')
      .set(admin)
      .send({ title: 'Bien à valider', address: { street: '1 rue Test', postalCode: '75001', arrondissement: 1 }, capacity: 2, surfaceM2: 20, nightlyRateHtCents: 9000 });
    const response = await request(ctx.app)
      .post('/api/bookings/stays')
      .set(traveler)
      .send({ propertyId: draft.body.id, startDate: '2026-12-10', endDate: '2026-12-12', guests: 1 });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PROPERTY_NOT_FOUND');
  });

  it('une prestation désactivée disparaît du catalogue et n’est plus réservable', async () => {
    await request(ctx.app).patch('/api/admin/offerings/' + fx.fixedOfferingId).set(admin).send({ active: false });
    const names = (await request(ctx.app).get('/api/catalog/offerings')).body.map((o: { id: string }) => o.id);
    expect(names).not.toContain(fx.fixedOfferingId);

    const booking = await request(ctx.app)
      .post('/api/bookings/services')
      .set(traveler)
      .send({ offeringId: fx.fixedOfferingId, qty: 1, scheduledAt: '2026-12-01T10:00:00.000Z' });
    expect(booking.status).toBe(404);
    expect(booking.body.error.code).toBe('OFFERING_NOT_FOUND');

    await request(ctx.app).patch('/api/admin/offerings/' + fx.fixedOfferingId).set(admin).send({ active: true });
  });

  it('les références croisées du catalogue sont contrôlées', async () => {
    const badCategory = await request(ctx.app)
      .post('/api/admin/offerings')
      .set(admin)
      .send({ name: 'X', categoryId: ABSENT, providerId: fx.providerId, pricingRule: { unit: 'fixed', baseCents: 1000, tiers: [{ upToQty: null, unitPriceCents: 0 }], minCents: 100 } });
    expect(badCategory.status).toBe(404);
    expect(badCategory.body.error.code).toBe('CATEGORY_NOT_FOUND');

    const badProvider = await request(ctx.app)
      .post('/api/admin/offerings')
      .set(admin)
      .send({ name: 'X', categoryId: fx.categoryId, providerId: ABSENT, pricingRule: { unit: 'fixed', baseCents: 1000, tiers: [{ upToQty: null, unitPriceCents: 0 }], minCents: 100 } });
    expect(badProvider.status).toBe(404);
    expect(badProvider.body.error.code).toBe('PROVIDER_NOT_FOUND');
  });

  it('un slug de catégorie déjà pris est refusé, et une catégorie utilisée n’est pas supprimable', async () => {
    const duplicate = await request(ctx.app).post('/api/admin/categories').set(admin).send({ name: 'Transport bis', slug: 'transport' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('SLUG_TAKEN');

    const inUse = await request(ctx.app).delete('/api/admin/categories/' + fx.categoryId).set(admin);
    expect(inUse.status).toBe(409);
    expect(inUse.body.error.code).toBe('CATEGORY_IN_USE');
  });

  it('la photo supprimée doit appartenir au bien visé', async () => {
    const uploaded = await request(ctx.app)
      .post('/api/admin/properties/' + fx.propertyId + '/photos')
      .set(admin)
      .attach('file', samplePng(), { filename: 'a.png', contentType: 'image/png' });
    const fileId = uploaded.body.photoIds[0];

    const other = await request(ctx.app)
      .post('/api/admin/properties')
      .set(admin)
      .send({ title: 'Autre bien', address: { street: '2 rue Test', postalCode: '75001', arrondissement: 1 }, capacity: 2, surfaceM2: 20, nightlyRateHtCents: 9000 });
    const wrongOwner = await request(ctx.app).delete('/api/admin/properties/' + other.body.id + '/photos/' + fileId).set(admin);
    expect(wrongOwner.status).toBe(404);
    expect(wrongOwner.body.error.code).toBe('PHOTO_NOT_FOUND');
  });

  it('un envoi de fichier sans pièce jointe est refusé', async () => {
    const response = await request(ctx.app).post('/api/files').set(admin).field('kind', 'booking_attachment');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('FILE_REQUIRED');
  });

  it('un statut de virement ne s’applique pas à une facture voyageur', async () => {
    const stay = await request(ctx.app)
      .post('/api/bookings/stays')
      .set(traveler)
      .send({ propertyId: fx.propertyId, startDate: '2027-01-05', endDate: '2027-01-07', guests: 2 });
    const { emitTravelerInvoice } = await import('../../src/services/invoice.service');
    const invoice = await emitTravelerInvoice('stay', stay.body.id);

    const response = await request(ctx.app).patch('/api/admin/invoices/' + invoice.id + '/payout').set(admin).send({ payoutStatus: 'sent' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('NOT_A_PROVIDER_INVOICE');

    const absent = await request(ctx.app).patch('/api/admin/invoices/' + ABSENT + '/payout').set(admin).send({ payoutStatus: 'sent' });
    expect(absent.status).toBe(404);
    expect(absent.body.error.code).toBe('INVOICE_NOT_FOUND');
  });

  it('la modération d’un avis inexistant et la qualification d’un lead inexistant renvoient 404', async () => {
    const review = await request(ctx.app).patch('/api/admin/reviews/' + ABSENT + '/moderation').set(admin).send({ moderation: 'approved' });
    expect(review.status).toBe(404);
    expect(review.body.error.code).toBe('REVIEW_NOT_FOUND');

    const lead = await request(ctx.app).patch('/api/admin/leads/' + ABSENT).set(admin).send({ status: 'contacted' });
    expect(lead.status).toBe(404);
    expect(lead.body.error.code).toBe('LEAD_NOT_FOUND');

    const contact = await request(ctx.app)
      .post('/api/simulator/leads/' + ABSENT + '/contact')
      .send({ firstName: 'A', lastName: 'B', email: 'a@b.fr' });
    expect(contact.status).toBe(404);
    expect(contact.body.error.code).toBe('LEAD_NOT_FOUND');
  });

  it('une prestation annulée ne peut plus être payée ni commentée', async () => {
    const booking = await request(ctx.app)
      .post('/api/bookings/services')
      .set(traveler)
      .send({ offeringId: fx.taxiOfferingId, qty: 4, scheduledAt: '2026-12-20T10:00:00.000Z' });
    await request(ctx.app).post('/api/bookings/services/' + booking.body.id + '/cancel').set(traveler);

    const payment = await request(ctx.app).post('/api/payments/intent').set(traveler).send({ kind: 'service', bookingId: booking.body.id });
    expect(payment.status).toBe(409);
    expect(payment.body.error.code).toBe('BOOKING_CANCELLED');

    const review = await request(ctx.app).post('/api/reviews').set(traveler).send({ bookingId: booking.body.id, rating: 5 });
    expect(review.status).toBe(409);
    expect(review.body.error.code).toBe('BOOKING_NOT_COMPLETED');
  });
});
