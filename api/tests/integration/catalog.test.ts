import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { computePriceHt } from '../../src/services/pricing/pricingEngine';
import { taxiRule } from '../pricing/fixtures';
import { createAdmin, makeExplorator, registerTraveler, startTestApp, type TestApp } from './setup';

describe('catalogue et modération', () => {
  let ctx: TestApp;
  let adminToken: string;
  let categoryId: string;
  let providerId: string;

  beforeAll(async () => {
    ctx = await startTestApp();
    adminToken = await createAdmin(ctx.app);
    const provider = await request(ctx.app)
      .post('/api/admin/providers')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'Taxi Paris', job: 'chauffeur', email: 'taxi@test.fr' });
    expect(provider.status).toBe(201);
    providerId = provider.body.id;
    const category = await request(ctx.app)
      .post('/api/admin/categories')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'Transport', slug: 'transport' });
    expect(category.status).toBe(201);
    categoryId = category.body.id;
  });

  afterAll(() => ctx.stop());

  function admin() {
    return { Authorization: 'Bearer ' + adminToken };
  }

  it('crée une prestation à paliers et l’aperçu de prix correspond au moteur', async () => {
    const created = await request(ctx.app)
      .post('/api/admin/offerings')
      .set(admin())
      .send({ name: 'Transfert aéroport', categoryId, providerId, pricingRule: taxiRule });
    expect(created.status).toBe(201);
    expect(created.body.pricingRule).toEqual(taxiRule);

    const preview = await request(ctx.app)
      .post('/api/admin/pricing/preview')
      .set(admin())
      .send({ pricingRule: created.body.pricingRule, qty: 10.5 });
    expect(preview.status).toBe(200);
    expect(preview.body).toEqual({ priceHtCents: computePriceHt(taxiRule, 10.5) });
    expect(preview.body.priceHtCents).toBe(2075);
  });

  it('refuse un pricingRule aux paliers désordonnés en 400 VALIDATION_ERROR', async () => {
    const response = await request(ctx.app)
      .post('/api/admin/offerings')
      .set(admin())
      .send({
        name: 'Cassé',
        categoryId,
        providerId,
        pricingRule: { unit: 'km', baseCents: 0, minCents: 100, tiers: [{ upToQty: 10, unitPriceCents: 200 }, { upToQty: 5, unitPriceCents: 100 }, { upToQty: null, unitPriceCents: 50 }] },
      });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.pricingRule).toBeDefined();
  });

  it('un bien pending passe published puis rejected, et le catalogue public suit', async () => {
    const created = await request(ctx.app)
      .post('/api/admin/properties')
      .set(admin())
      .send({
        title: 'Studio Montorgueil',
        address: { street: '23 rue Montorgueil', postalCode: '75002', arrondissement: 2 },
        capacity: 2,
        surfaceM2: 25,
        nightlyRateHtCents: 12000,
      });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('pending');
    const id = created.body.id;

    expect((await request(ctx.app).get('/api/catalog/properties')).body).toHaveLength(0);
    expect((await request(ctx.app).get('/api/catalog/properties/' + id)).status).toBe(404);

    const published = await request(ctx.app).patch('/api/admin/properties/' + id + '/status').set(admin()).send({ status: 'published' });
    expect(published.body.status).toBe('published');
    expect((await request(ctx.app).get('/api/catalog/properties')).body.map((p: { id: string }) => p.id)).toEqual([id]);
    expect((await request(ctx.app).get('/api/catalog/properties/' + id)).status).toBe(200);

    await request(ctx.app).patch('/api/admin/properties/' + id + '/status').set(admin()).send({ status: 'rejected', rejectionReason: 'Photos manquantes' });
    expect((await request(ctx.app).get('/api/catalog/properties')).body).toHaveLength(0);
  });

  it('une prestation vipOnly est invisible pour un anonyme et un Free, visible pour un Explorator et un admin', async () => {
    const vip = await request(ctx.app)
      .post('/api/admin/offerings')
      .set(admin())
      .send({ name: 'Conciergerie privée', categoryId, providerId, vipOnly: true, pricingRule: { unit: 'fixed', baseCents: 30000, minCents: 100, tiers: [{ upToQty: null, unitPriceCents: 0 }] } });
    expect(vip.status).toBe(201);
    const vipId = vip.body.id;
    const names = (response: request.Response) => response.body.map((o: { name: string }) => o.name);

    expect(names(await request(ctx.app).get('/api/catalog/offerings'))).not.toContain('Conciergerie privée');

    const free = await registerTraveler(ctx.app, 'free@test.fr');
    expect(names(await request(ctx.app).get('/api/catalog/offerings').set('Authorization', 'Bearer ' + free.token))).not.toContain('Conciergerie privée');
    const forbidden = await request(ctx.app).get('/api/catalog/offerings/' + vipId).set('Authorization', 'Bearer ' + free.token);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('VIP_REQUIRED');

    const explorator = await registerTraveler(ctx.app, 'explorator@test.fr');
    await makeExplorator(explorator.user.id);
    expect(names(await request(ctx.app).get('/api/catalog/offerings').set('Authorization', 'Bearer ' + explorator.token))).toContain('Conciergerie privée');
    expect(names(await request(ctx.app).get('/api/catalog/offerings').set(admin()))).toContain('Conciergerie privée');
  });
});
