import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { completeServiceBooking, createAdmin, registerTraveler, seedCatalog, startTestApp, type CatalogFixtures, type TestApp } from './setup';
import { downloadBinary, pdfText } from './invoiceHelpers';

describe('factures prestataires mensuelles', () => {
  let ctx: TestApp;
  let fx: CatalogFixtures;
  let admin: { Authorization: string };
  let adminToken: string;
  let lea: { Authorization: string };
  const netsInPeriod: number[] = [];
  let grossInPeriod = 0;
  let commissionInPeriod = 0;

  async function book(scheduledAt: string, qty: number, complete: boolean) {
    const booking = await request(ctx.app)
      .post('/api/bookings/services')
      .set(lea)
      .send({ offeringId: fx.taxiOfferingId, qty, scheduledAt });
    expect(booking.status).toBe(201);
    if (complete) {
      await completeServiceBooking(ctx.app, adminToken, booking.body.id);
    }
    return booking.body.pricing;
  }

  beforeAll(async () => {
    ctx = await startTestApp();
    adminToken = await createAdmin(ctx.app);
    admin = { Authorization: 'Bearer ' + adminToken };
    fx = await seedCatalog(ctx.app, adminToken);
    lea = { Authorization: 'Bearer ' + (await registerTraveler(ctx.app, 'lea@test.fr')).token };

    for (const [day, qty] of [['05', 5], ['12', 10.5], ['27', 30]] as [string, number][]) {
      const pricing = await book('2026-10-' + day + 'T09:00:00.000Z', qty, true);
      netsInPeriod.push(pricing.providerNetHtCents);
      grossInPeriod += pricing.grossHtCents;
      commissionInPeriod += pricing.commissionHtCents;
    }
    await book('2026-09-30T09:00:00.000Z', 8, true);
    await book('2026-11-01T09:00:00.000Z', 8, true);
    await book('2026-10-15T09:00:00.000Z', 8, false);
  });

  afterAll(() => ctx.stop());

  const providerInvoices = async () => (await request(ctx.app).get('/api/admin/invoices?type=provider').set(admin)).body;

  it('le net à payer est la somme des providerNetHtCents des réservations réalisées du mois', async () => {
    const generated = await request(ctx.app).post('/api/admin/invoices/provider-payouts').set(admin).send({ year: 2026, month: 10 });
    expect(generated.status).toBe(201);
    expect(generated.body.created).toHaveLength(1);

    const invoice = generated.body.created[0];
    const expectedNet = netsInPeriod.reduce((sum, value) => sum + value, 0);
    expect(invoice.number).toBe('FP-2026-10-' + fx.providerId);
    expect(invoice.type).toBe('provider');
    expect(invoice.period).toEqual({ year: 2026, month: 10 });
    expect(invoice.payoutStatus).toBe('pending');
    expect(invoice.lines).toHaveLength(3);
    expect(invoice.totals.providerNetHtCents).toBe(expectedNet);
    expect(invoice.totals.grossHtCents).toBe(grossInPeriod);
    expect(invoice.totals.commissionHtCents).toBe(commissionInPeriod);
    expect(invoice.totals.grossHtCents - invoice.totals.commissionHtCents).toBe(expectedNet);

    const text = pdfText((await downloadBinary(ctx.app, '/api/files/' + invoice.gridFsId, admin)).body);
    expect(text).toContain('Facture prestataire');
    expect(text).toContain(invoice.number);
  });

  it('les lignes reprennent les snapshots, y compris après modification du barème', async () => {
    const invoice = (await providerInvoices())[0];
    const pdfBefore = await downloadBinary(ctx.app, '/api/files/' + invoice.gridFsId, admin);

    await request(ctx.app).put('/api/admin/pricing/commission-tiers').set(admin).send([{ upToCents: null, rateBps: 9000 }]);
    await request(ctx.app)
      .patch('/api/admin/offerings/' + fx.taxiOfferingId)
      .set(admin)
      .send({ pricingRule: { unit: 'km', baseCents: 100000, tiers: [{ upToQty: null, unitPriceCents: 9999 }], minCents: 100 } });

    expect((await providerInvoices())[0]).toEqual(invoice);
    const pdfAfter = await downloadBinary(ctx.app, '/api/files/' + invoice.gridFsId, admin);
    expect(Buffer.compare(pdfAfter.body, pdfBefore.body)).toBe(0);
  });

  it('régénérer le même mois n’émet pas de doublon', async () => {
    const again = await request(ctx.app).post('/api/admin/invoices/provider-payouts').set(admin).send({ year: 2026, month: 10 });
    expect(again.body.created).toHaveLength(0);
    expect(again.body.skipped).toEqual(['FP-2026-10-' + fx.providerId]);
    expect(await providerInvoices()).toHaveLength(1);
  });

  it('un mois sans prestation réalisée ne produit aucune facture', async () => {
    const empty = await request(ctx.app).post('/api/admin/invoices/provider-payouts').set(admin).send({ year: 2026, month: 8 });
    expect(empty.body).toEqual({ created: [], skipped: [] });
  });

  it('le statut de virement est piloté depuis le back-office', async () => {
    const invoice = (await providerInvoices())[0];
    const sent = await request(ctx.app).patch('/api/admin/invoices/' + invoice.id + '/payout').set(admin).send({ payoutStatus: 'sent' });
    expect(sent.body.payoutStatus).toBe('sent');
    expect(sent.body.payoutAt).not.toBeNull();
    const back = await request(ctx.app).patch('/api/admin/invoices/' + invoice.id + '/payout').set(admin).send({ payoutStatus: 'pending' });
    expect(back.body.payoutStatus).toBe('pending');
    expect(back.body.payoutAt).toBeNull();
  });

  it('un voyageur ne peut ni lister ni générer les factures prestataires', async () => {
    expect((await request(ctx.app).get('/api/admin/invoices').set(lea)).status).toBe(403);
    expect((await request(ctx.app).post('/api/admin/invoices/provider-payouts').set(lea).send({ year: 2026, month: 10 })).status).toBe(403);
  });
});
