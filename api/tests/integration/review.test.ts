import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  completeServiceBooking,
  createAdmin,
  makeBagpacker,
  makeExplorator,
  registerTraveler,
  seedCatalog,
  startTestApp,
  type CatalogFixtures,
  type TestApp,
} from './setup';

describe('avis : dépôt, modération et note du prestataire', () => {
  let ctx: TestApp;
  let fx: CatalogFixtures;
  let adminToken: string;
  let admin: { Authorization: string };
  let free: { Authorization: string };
  const scheduledAt = '2026-10-02T10:00:00.000Z';

  async function bookAndComplete(auth: { Authorization: string }): Promise<string> {
    const booking = await request(ctx.app)
      .post('/api/bookings/services')
      .set(auth)
      .send({ offeringId: fx.taxiOfferingId, qty: 5, scheduledAt });
    await completeServiceBooking(ctx.app, adminToken, booking.body.id);
    return booking.body.id;
  }

  const providerRating = async () => {
    const providers = await request(ctx.app).get('/api/admin/providers').set(admin);
    const provider = providers.body.find((p: { id: string }) => p.id === fx.providerId);
    return { count: provider.ratingCount, sum: provider.ratingSum };
  };

  beforeAll(async () => {
    ctx = await startTestApp();
    adminToken = await createAdmin(ctx.app);
    admin = { Authorization: 'Bearer ' + adminToken };
    fx = await seedCatalog(ctx.app, adminToken);
    free = { Authorization: 'Bearer ' + (await registerTraveler(ctx.app, 'free@test.fr')).token };
  });

  afterAll(() => ctx.stop());

  it('un avis sur une prestation non terminée est refusé', async () => {
    const booking = await request(ctx.app)
      .post('/api/bookings/services')
      .set(free)
      .send({ offeringId: fx.taxiOfferingId, qty: 5, scheduledAt });
    const refused = await request(ctx.app).post('/api/reviews').set(free).send({ bookingId: booking.body.id, rating: 5 });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('BOOKING_NOT_COMPLETED');
  });

  it('les trois formules peuvent déposer un avis, Free comprise', async () => {
    const bagpacker = await registerTraveler(ctx.app, 'bagpacker@test.fr');
    await makeBagpacker(bagpacker.user.id);
    const explorator = await registerTraveler(ctx.app, 'explorator@test.fr');
    await makeExplorator(explorator.user.id);

    for (const auth of [free, { Authorization: 'Bearer ' + bagpacker.token }, { Authorization: 'Bearer ' + explorator.token }]) {
      const bookingId = await bookAndComplete(auth);
      const review = await request(ctx.app).post('/api/reviews').set(auth).send({ bookingId, rating: 4, comment: 'Chauffeur ponctuel' });
      expect(review.status).toBe(201);
      expect(review.body.moderation).toBe('pending');
    }
    expect((await request(ctx.app).get('/api/admin/reviews?moderation=pending').set(admin)).body).toHaveLength(3);
  });

  it('un avis ne peut être déposé qu’une fois par réservation, et seulement par son auteur', async () => {
    const bookingId = await bookAndComplete(free);
    expect((await request(ctx.app).post('/api/reviews').set(free).send({ bookingId, rating: 5 })).status).toBe(201);

    const duplicate = await request(ctx.app).post('/api/reviews').set(free).send({ bookingId, rating: 1 });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('REVIEW_ALREADY_SUBMITTED');

    const other = await registerTraveler(ctx.app, 'autre@test.fr');
    const stranger = await request(ctx.app)
      .post('/api/reviews')
      .set('Authorization', 'Bearer ' + other.token)
      .send({ bookingId, rating: 1 });
    expect(stranger.status).toBe(403);
  });

  it('un avis pending n’est ni public ni compté dans la note, un avis approuvé l’est', async () => {
    expect(await providerRating()).toEqual({ count: 0, sum: 0 });
    expect((await request(ctx.app).get('/api/catalog/offerings/' + fx.taxiOfferingId + '/reviews')).body).toHaveLength(0);

    const pending = (await request(ctx.app).get('/api/admin/reviews?moderation=pending').set(admin)).body;
    const approved = await request(ctx.app)
      .patch('/api/admin/reviews/' + pending[0].id + '/moderation')
      .set(admin)
      .send({ moderation: 'approved' });
    expect(approved.body.moderation).toBe('approved');
    expect(approved.body.moderatedAt).not.toBeNull();

    const publicReviews = (await request(ctx.app).get('/api/catalog/offerings/' + fx.taxiOfferingId + '/reviews')).body;
    expect(publicReviews).toHaveLength(1);
    expect(publicReviews[0].id).toBe(pending[0].id);
    expect(await providerRating()).toEqual({ count: 1, sum: pending[0].rating });
  });

  it('rejeter un avis le retire du public et de la note moyenne', async () => {
    const pending = (await request(ctx.app).get('/api/admin/reviews?moderation=pending').set(admin)).body;
    await request(ctx.app)
      .patch('/api/admin/reviews/' + pending[0].id + '/moderation')
      .set(admin)
      .send({ moderation: 'approved' });
    const before = await providerRating();
    expect(before.count).toBe(2);

    const rejected = await request(ctx.app)
      .patch('/api/admin/reviews/' + pending[0].id + '/moderation')
      .set(admin)
      .send({ moderation: 'rejected', moderationReason: 'Propos hors sujet' });
    expect(rejected.body.moderationReason).toBe('Propos hors sujet');
    expect(await providerRating()).toEqual({ count: 1, sum: before.sum - pending[0].rating });
    const publicIds = (await request(ctx.app).get('/api/catalog/offerings/' + fx.taxiOfferingId + '/reviews')).body.map((r: { id: string }) => r.id);
    expect(publicIds).not.toContain(pending[0].id);
  });

  it('un voyageur ne peut pas modérer', async () => {
    const anyReview = (await request(ctx.app).get('/api/admin/reviews').set(admin)).body[0];
    expect((await request(ctx.app).get('/api/admin/reviews').set(free)).status).toBe(403);
    expect(
      (await request(ctx.app).patch('/api/admin/reviews/' + anyReview.id + '/moderation').set(free).send({ moderation: 'approved' })).status,
    ).toBe(403);
  });

  it('le voyageur retrouve ses propres avis avec leur statut de modération', async () => {
    const mine = await request(ctx.app).get('/api/reviews').set(free);
    expect(mine.body.length).toBeGreaterThan(0);
    expect(mine.body.every((review: { moderation: string }) => ['pending', 'approved', 'rejected'].includes(review.moderation))).toBe(true);
  });
});
