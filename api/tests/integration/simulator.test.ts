import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { simulatorLimiter } from '../../src/routes/simulator.routes';
import { createAdmin, registerTraveler, startTestApp, type TestApp } from './setup';

const INPUT = {
  arrondissement: 2,
  surfaceM2: 25,
  capacity: 2,
  bedrooms: 1,
  nightlyRateHtCents: 12000,
  occupancyRateBps: 6000,
  averageStayNights: 3,
  optionKeys: ['cleaning'],
};

describe('simulateur de devis public et leads', () => {
  let ctx: TestApp;
  let admin: { Authorization: string };
  let traveler: { Authorization: string };

  beforeAll(async () => {
    ctx = await startTestApp();
    admin = { Authorization: 'Bearer ' + (await createAdmin(ctx.app)) };
    traveler = { Authorization: 'Bearer ' + (await registerTraveler(ctx.app, 'lea@test.fr')).token };
  });

  beforeEach(() => simulatorLimiter.reset());

  afterAll(() => ctx.stop());

  const leads = async (query = '') => (await request(ctx.app).get('/api/admin/leads' + query).set(admin)).body;

  it('les options du simulateur sont publiques et viennent de la configuration', async () => {
    const response = await request(ctx.app).get('/api/simulator/options');
    expect(response.status).toBe(200);
    expect(response.body.map((option: { key: string }) => option.key)).toContain('cleaning');
    expect(response.body[0]).toHaveProperty('priceHtCents');
  });

  it('une simulation anonyme renvoie une ventilation détaillée et crée un lead', async () => {
    expect(await leads()).toHaveLength(0);

    const response = await request(ctx.app).post('/api/simulator/simulate').send(INPUT);
    expect(response.status).toBe(201);
    expect(response.body.leadId).toBeDefined();

    const { breakdown } = response.body;
    expect(breakdown.assumptions).toMatchObject({ occupiedNights: 219, estimatedStays: 73, commissionBps: 2000 });
    expect(breakdown.grossRevenueHtCents).toBe(2628000);
    expect(breakdown.charges.platformCommissionHtCents).toBe(525600);
    expect(breakdown.charges.ownerYearlyFeeCents).toBe(10000);
    expect(breakdown.charges.options).toHaveLength(1);
    expect(breakdown.charges.totalHtCents).toBe(525600 + 10000 + 365000);
    expect(breakdown.net.yearlyHtCents).toBe(2628000 - 900600);

    const persisted = await leads();
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({ status: 'new', contact: null });
    expect(persisted[0].breakdown.net.yearlyHtCents).toBe(breakdown.net.yearlyHtCents);
    expect(persisted[0].input.occupancyRateBps).toBe(6000);
  });

  it('deux simulations identiques donnent exactement le même résultat', async () => {
    const first = await request(ctx.app).post('/api/simulator/simulate').send(INPUT);
    const second = await request(ctx.app).post('/api/simulator/simulate').send(INPUT);
    expect(second.body.breakdown).toEqual(first.body.breakdown);
  });

  it('la validation Zod est stricte : entrées hors bornes et champs inconnus refusés', async () => {
    const outOfRange = await request(ctx.app).post('/api/simulator/simulate').send({ ...INPUT, occupancyRateBps: 12000 });
    expect(outOfRange.status).toBe(400);
    expect(outOfRange.body.error.code).toBe('VALIDATION_ERROR');

    expect((await request(ctx.app).post('/api/simulator/simulate').send({ ...INPUT, arrondissement: 42 })).status).toBe(400);
    expect((await request(ctx.app).post('/api/simulator/simulate').send({ ...INPUT, nightlyRateHtCents: 12.5 })).status).toBe(400);
    expect((await request(ctx.app).post('/api/simulator/simulate').send({ ...INPUT, siret: '12345' })).status).toBe(400);
    expect((await request(ctx.app).post('/api/simulator/simulate').send({})).status).toBe(400);
  });

  it('modifier la commission en admin change la simulation suivante', async () => {
    const before = await request(ctx.app).post('/api/simulator/simulate').send(INPUT);
    expect(before.body.breakdown.charges.platformCommissionHtCents).toBe(525600);

    await request(ctx.app).patch('/api/admin/pricing/settings').set(admin).send({ stayCommissionBps: 3000, ownerYearlyFeeCents: 15000 });

    const after = await request(ctx.app).post('/api/simulator/simulate').send(INPUT);
    expect(after.body.breakdown.assumptions.commissionBps).toBe(3000);
    expect(after.body.breakdown.charges.platformCommissionHtCents).toBe(788400);
    expect(after.body.breakdown.charges.ownerYearlyFeeCents).toBe(15000);
    expect(after.body.breakdown.net.yearlyHtCents).toBeLessThan(before.body.breakdown.net.yearlyHtCents);

    await request(ctx.app).patch('/api/admin/pricing/settings').set(admin).send({ stayCommissionBps: 2000, ownerYearlyFeeCents: 10000 });
  });

  it('le visiteur dépose ses coordonnées et le lead devient qualifiable', async () => {
    const simulation = await request(ctx.app).post('/api/simulator/simulate').send(INPUT);
    const leadId = simulation.body.leadId;

    const contact = await request(ctx.app)
      .post('/api/simulator/leads/' + leadId + '/contact')
      .send({ firstName: 'Camille', lastName: 'Bailleur', email: 'camille@example.fr', phone: '0601020304' });
    expect(contact.status).toBe(200);

    const again = await request(ctx.app)
      .post('/api/simulator/leads/' + leadId + '/contact')
      .send({ firstName: 'Camille', lastName: 'Bailleur', email: 'autre@example.fr' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('CONTACT_ALREADY_PROVIDED');

    const qualified = await request(ctx.app)
      .patch('/api/admin/leads/' + leadId)
      .set(admin)
      .send({ status: 'contacted', notes: 'Rappelé le 12/09, rendez-vous fixé.' });
    expect(qualified.body).toMatchObject({ status: 'contacted', notes: 'Rappelé le 12/09, rendez-vous fixé.' });
    expect(qualified.body.contact.email).toBe('camille@example.fr');

    expect(await leads('?status=contacted')).toHaveLength(1);
    expect((await leads('?withContact=true')).length).toBe(1);
  });

  it('l’export CSV reprend les leads avec leur ventilation', async () => {
    const response = await request(ctx.app).get('/api/admin/leads/export.csv').set(admin);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    const lines = response.text.trim().split('\n');
    expect(lines[0]).toContain('net_annuel_ht_eur');
    expect(lines.length).toBeGreaterThan(1);
    expect(response.text).toContain('camille@example.fr');
  });

  it('les leads sont réservés à l’administration', async () => {
    expect((await request(ctx.app).get('/api/admin/leads')).status).toBe(401);
    expect((await request(ctx.app).get('/api/admin/leads').set(traveler)).status).toBe(403);
    expect((await request(ctx.app).get('/api/admin/leads/export.csv').set(traveler)).status).toBe(403);
  });

  it('30 requêtes en rafale déclenchent 429 RATE_LIMITED', async () => {
    const responses = [];
    for (let attempt = 0; attempt < 30; attempt += 1) {
      responses.push(await request(ctx.app).post('/api/simulator/simulate').send(INPUT));
    }
    const accepted = responses.filter((response) => response.status === 201);
    const limited = responses.filter((response) => response.status === 429);
    expect(accepted).toHaveLength(20);
    expect(limited).toHaveLength(10);
    expect(limited[0].body.error.code).toBe('RATE_LIMITED');

    simulatorLimiter.reset();
    expect((await request(ctx.app).post('/api/simulator/simulate').send(INPUT)).status).toBe(201);
  });
});
