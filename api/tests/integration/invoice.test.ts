import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAdmin, makeExplorator, registerTraveler, seedCatalog, startTestApp, type CatalogFixtures, type TestApp } from './setup';
import { downloadBinary, pdfText, samplePng } from './invoiceHelpers';
import { signedWebhook, stripeEvent } from './stripeHelpers';

function paidIntent(id: string, bookingKind: string, bookingId: string, userId: string, amount: number) {
  return {
    id,
    object: 'payment_intent',
    amount,
    currency: 'eur',
    status: 'succeeded',
    metadata: { bookingKind, bookingId, userId },
  };
}

describe('GridFS, factures PDF archivées et reversements', () => {
  let ctx: TestApp;
  let fx: CatalogFixtures;
  let admin: { Authorization: string };
  let lea: { Authorization: string };
  let leaId: string;
  let bob: { Authorization: string };
  let stayId: string;
  let stayTotal: number;

  beforeAll(async () => {
    ctx = await startTestApp();
    const adminToken = await createAdmin(ctx.app);
    admin = { Authorization: 'Bearer ' + adminToken };
    fx = await seedCatalog(ctx.app, adminToken);
    const registered = await registerTraveler(ctx.app, 'lea@test.fr');
    lea = { Authorization: 'Bearer ' + registered.token };
    leaId = registered.user.id;
    bob = { Authorization: 'Bearer ' + (await registerTraveler(ctx.app, 'bob@test.fr')).token };

    const stay = await request(ctx.app)
      .post('/api/bookings/stays')
      .set(lea)
      .send({ propertyId: fx.propertyId, startDate: '2026-10-01', endDate: '2026-10-04', guests: 2 });
    stayId = stay.body.id;
    stayTotal = stay.body.pricing.totalTtcCents;
  });

  afterAll(() => ctx.stop());

  const myInvoices = async (auth: { Authorization: string }) => (await request(ctx.app).get('/api/invoices').set(auth)).body;

  it('une photo de bien est stockée en GridFS, rattachée au bien et servie publiquement', async () => {
    const uploaded = await request(ctx.app)
      .post('/api/admin/properties/' + fx.propertyId + '/photos')
      .set(admin)
      .attach('file', samplePng(), { filename: 'studio.png', contentType: 'image/png' });
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.photoIds).toHaveLength(1);
    const fileId = uploaded.body.photoIds[0];

    const fiche = await request(ctx.app).get('/api/catalog/properties/' + fx.propertyId);
    expect(fiche.body.photoIds).toEqual([fileId]);

    const served = await downloadBinary(ctx.app, '/api/files/' + fileId);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['cache-control']).toContain('private');
    expect(served.headers.etag).toBe('"' + fileId + '"');
    expect(served.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(Buffer.compare(served.body, samplePng())).toBe(0);

    const cached = await request(ctx.app).get('/api/files/' + fileId).set('If-None-Match', '"' + fileId + '"');
    expect(cached.status).toBe(304);
  });

  it('refuse un type MIME hors allowlist pour une photo de bien', async () => {
    const refused = await request(ctx.app)
      .post('/api/admin/properties/' + fx.propertyId + '/photos')
      .set(admin)
      .attach('file', Buffer.from('%PDF-1.4'), { filename: 'faux.pdf', contentType: 'application/pdf' });
    expect(refused.status).toBe(400);
    expect(refused.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('une facture est émise après un paiement réussi et son PDF porte HT, TVA, TTC et le numéro', async () => {
    expect(await myInvoices(lea)).toHaveLength(0);
    await signedWebhook(ctx.app, stripeEvent('evt_pay_stay', 'payment_intent.succeeded', paidIntent('pi_stay', 'stay', stayId, leaId, stayTotal)));

    const invoices = await myInvoices(lea);
    expect(invoices).toHaveLength(1);
    const invoice = invoices[0];
    expect(invoice.number).toMatch(/^FV-\d{4}-\d{6}$/);
    expect(invoice.type).toBe('traveler');
    expect(invoice.booking).toEqual({ kind: 'stay', id: stayId });
    expect(invoice.totals).toMatchObject({ grossHtCents: 36000, vatCents: 3600, totalTtcCents: 39600 });

    const pdf = await downloadBinary(ctx.app, '/api/files/' + invoice.gridFsId, lea);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
    const text = pdfText(pdf.body);
    expect(text).toContain(invoice.number);
    expect(text).toContain('Montant HT : 360,00 EUR');
    expect(text).toContain('TVA 10 % : 36,00 EUR');
    expect(text).toContain('Net à payer TTC : 396,00 EUR');
  });

  it('la facture d’une prestation offerte porte la remise VIP et un total nul', async () => {
    const vip = await registerTraveler(ctx.app, 'vip@test.fr');
    await makeExplorator(vip.user.id);
    const auth = { Authorization: 'Bearer ' + vip.token };

    const booking = await request(ctx.app)
      .post('/api/bookings/services')
      .set(auth)
      .send({ offeringId: fx.fixedOfferingId, qty: 1, scheduledAt: '2026-10-02T10:00:00.000Z' });
    expect(booking.body.pricing.totalTtcCents).toBe(0);
    expect(booking.body.paymentStatus).toBe('paid');

    const invoices = await myInvoices(auth);
    expect(invoices).toHaveLength(1);
    expect(invoices[0].totals).toMatchObject({ grossHtCents: 5000, discountHtCents: 5000, netHtCents: 0, totalTtcCents: 0 });
    const text = pdfText((await downloadBinary(ctx.app, '/api/files/' + invoices[0].gridFsId, auth)).body);
    expect(text).toContain('Prestation offerte');
    expect(text).toContain('Total TTC : 0,00 EUR');
  });

  it('le voyageur A ne télécharge pas la facture du voyageur B', async () => {
    const invoice = (await myInvoices(lea))[0];
    const forbidden = await request(ctx.app).get('/api/files/' + invoice.gridFsId).set(bob);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');

    expect((await request(ctx.app).get('/api/files/' + invoice.gridFsId)).status).toBe(403);
    expect((await request(ctx.app).get('/api/invoices/' + invoice.id).set(bob)).status).toBe(403);
    expect((await request(ctx.app).get('/api/files/' + invoice.gridFsId).set(admin)).status).toBe(200);
    expect(await myInvoices(bob)).toHaveLength(0);
  });

  it('modifier les tarifs ne change ni la facture ni son PDF, octet pour octet', async () => {
    const invoice = (await myInvoices(lea))[0];
    const before = await downloadBinary(ctx.app, '/api/files/' + invoice.gridFsId, lea);

    expect((await request(ctx.app).put('/api/admin/pricing/commission-tiers').set(admin).send([{ upToCents: null, rateBps: 5000 }])).status).toBe(200);
    expect((await request(ctx.app).patch('/api/admin/properties/' + fx.propertyId).set(admin).send({ nightlyRateHtCents: 99900 })).status).toBe(200);
    expect((await request(ctx.app).patch('/api/admin/pricing/settings').set(admin).send({ stayCommissionBps: 5000 })).status).toBe(200);

    const after = await downloadBinary(ctx.app, '/api/files/' + invoice.gridFsId, lea);
    expect(Buffer.compare(after.body, before.body)).toBe(0);
    expect((await request(ctx.app).get('/api/invoices/' + invoice.id).set(lea)).body).toEqual(invoice);
  });

  it('deux émissions simultanées ne produisent jamais le même numéro', async () => {
    const { emitTravelerInvoice } = await import('../../src/services/invoice.service');
    const bookings = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        request(ctx.app)
          .post('/api/bookings/services')
          .set(bob)
          .send({ offeringId: fx.fixedOfferingId, qty: 1, scheduledAt: '2026-10-0' + ((i % 8) + 1) + 'T09:00:00.000Z' }),
      ),
    );
    const ids = bookings.map((response) => response.body.id as string);
    expect(new Set(ids).size).toBe(8);

    const invoices = await Promise.all(ids.map((id) => emitTravelerInvoice('service', id)));
    const numbers = invoices.map((invoice) => invoice.number);
    expect(new Set(numbers).size).toBe(8);
    expect(new Set(invoices.map((invoice) => invoice.gridFsId)).size).toBe(8);
  });

  it('émettre deux fois pour la même réservation renvoie la facture existante', async () => {
    const { emitTravelerInvoice } = await import('../../src/services/invoice.service');
    const first = await emitTravelerInvoice('stay', stayId);
    const [a, b] = await Promise.all([emitTravelerInvoice('stay', stayId), emitTravelerInvoice('stay', stayId)]);
    expect(a.id).toBe(first.id);
    expect(b.id).toBe(first.id);
    expect((await myInvoices(lea)).filter((i: { booking: { id: string } | null }) => i.booking?.id === stayId)).toHaveLength(1);
  });
});
