import type { Express } from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../../src/app';
import { connectDatabase, disconnectDatabase } from '../../src/config/database';
import * as commissionTierRepository from '../../src/repositories/commissionTier.repository';
import * as userRepository from '../../src/repositories/user.repository';
import * as vipPlanRepository from '../../src/repositories/vipPlan.repository';
import { hashPassword } from '../../src/services/auth.service';
import * as platformSettingsRepository from '../../src/repositories/platformSettings.repository';
import { DEFAULT_COMMISSION_TIERS, DEFAULT_SIMULATOR_OPTIONS, DEFAULT_VIP_PLANS } from '../../src/services/pricing/defaults';
import type { User } from '../../src/types/user';
import { fixedRule, taxiRule } from '../pricing/fixtures';

export type TestApp = { app: Express; stop: () => Promise<void> };

export async function startTestApp(): Promise<TestApp> {
  const mongo = await MongoMemoryServer.create();
  await connectDatabase(mongo.getUri());
  await commissionTierRepository.replaceCommissionTiers(DEFAULT_COMMISSION_TIERS);
  for (const plan of DEFAULT_VIP_PLANS) {
    await vipPlanRepository.upsertVipPlan(plan);
  }
  await platformSettingsRepository.updateSettings({ simulatorOptions: DEFAULT_SIMULATOR_OPTIONS });
  return {
    app: createApp(),
    stop: async () => {
      await disconnectDatabase();
      await mongo.stop();
    },
  };
}

export async function login(app: Express, email: string, password: string): Promise<string> {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  return response.body.token as string;
}

export async function createAdmin(app: Express, email = 'admin@test.fr'): Promise<string> {
  await userRepository.createUser({
    email,
    passwordHash: await hashPassword('admin-1234'),
    role: 'admin',
    profile: { firstName: 'Admin', lastName: 'Test' },
  });
  return login(app, email, 'admin-1234');
}

export async function registerTraveler(app: Express, email: string): Promise<{ token: string; user: User }> {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'motdepasse1', firstName: 'Test', lastName: 'Voyageur' });
  return { token: response.body.token, user: response.body.user };
}

export async function makeExplorator(userId: string, anchorAt = new Date()): Promise<void> {
  await userRepository.updateUserVip(userId, { tier: 'explorator', status: 'active', anchorAt });
}

export async function makeBagpacker(userId: string, anchorAt = new Date()): Promise<void> {
  await userRepository.updateUserVip(userId, { tier: 'bagpacker', status: 'active', anchorAt });
}

export type CatalogFixtures = {
  providerId: string;
  categoryId: string;
  taxiOfferingId: string;
  fixedOfferingId: string;
  vipOfferingId: string;
  propertyId: string;
};

export async function seedCatalog(app: Express, adminToken: string): Promise<CatalogFixtures> {
  const auth = { Authorization: 'Bearer ' + adminToken };
  const provider = await request(app).post('/api/admin/providers').set(auth).send({ name: 'Taxi Paris', job: 'chauffeur', email: 'taxi@test.fr' });
  const category = await request(app).post('/api/admin/categories').set(auth).send({ name: 'Transport', slug: 'transport' });
  const base = { categoryId: category.body.id, providerId: provider.body.id };
  const taxi = await request(app).post('/api/admin/offerings').set(auth).send({ ...base, name: 'Transfert aéroport', pricingRule: taxiRule, vatRateBps: 2000 });
  const fixed = await request(app).post('/api/admin/offerings').set(auth).send({ ...base, name: 'Ménage', pricingRule: fixedRule(5000), vatRateBps: 2000 });
  const vip = await request(app).post('/api/admin/offerings').set(auth).send({ ...base, name: 'Conciergerie privée', vipOnly: true, pricingRule: fixedRule(30000) });
  const property = await request(app).post('/api/admin/properties').set(auth).send({
    title: 'Studio Montorgueil',
    address: { street: '23 rue Montorgueil', postalCode: '75002', arrondissement: 2 },
    capacity: 2,
    surfaceM2: 25,
    nightlyRateHtCents: 12000,
    vatRateBps: 1000,
  });
  await request(app).patch('/api/admin/properties/' + property.body.id + '/status').set(auth).send({ status: 'published' });
  return {
    providerId: provider.body.id,
    categoryId: category.body.id,
    taxiOfferingId: taxi.body.id,
    fixedOfferingId: fixed.body.id,
    vipOfferingId: vip.body.id,
    propertyId: property.body.id,
  };
}

export async function completeServiceBooking(app: Express, adminToken: string, bookingId: string): Promise<void> {
  const auth = { Authorization: 'Bearer ' + adminToken };
  const statusUrl = '/api/admin/bookings/services/' + bookingId + '/status';
  await request(app).patch(statusUrl).set(auth).send({ status: 'confirmed' });
  const sheets = await request(app).get('/api/admin/interventions?status=prefilled').set(auth);
  const sheet = sheets.body.find((item: { bookingId: string }) => item.bookingId === bookingId);
  if (!sheet) {
    throw new Error('Fiche d’intervention absente pour ' + bookingId);
  }
  await request(app)
    .patch('/api/admin/interventions/' + sheet.id + '/complete')
    .set(auth)
    .send({ performedAt: new Date().toISOString(), durationMinutes: 60, workDone: 'Intervention réalisée' });
  await request(app).patch(statusUrl).set(auth).send({ status: 'completed' });
}
