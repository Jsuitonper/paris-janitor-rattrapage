import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAdmin, registerTraveler, seedCatalog, startTestApp, type CatalogFixtures, type TestApp } from './setup';

describe('messagerie par réservation', () => {
  let ctx: TestApp;
  let fx: CatalogFixtures;
  let admin: { Authorization: string };
  let lea: { Authorization: string };
  let bob: { Authorization: string };
  let bookingId: string;
  const scheduledAt = '2026-10-02T10:00:00.000Z';

  beforeAll(async () => {
    ctx = await startTestApp();
    const adminToken = await createAdmin(ctx.app);
    admin = { Authorization: 'Bearer ' + adminToken };
    fx = await seedCatalog(ctx.app, adminToken);
    lea = { Authorization: 'Bearer ' + (await registerTraveler(ctx.app, 'lea@test.fr')).token };
    bob = { Authorization: 'Bearer ' + (await registerTraveler(ctx.app, 'bob@test.fr')).token };

    const booking = await request(ctx.app)
      .post('/api/bookings/services')
      .set(lea)
      .send({ offeringId: fx.taxiOfferingId, qty: 5, scheduledAt });
    bookingId = booking.body.id;
  });

  afterAll(() => ctx.stop());

  it('un échange voyageur puis conciergerie puis voyageur s’affiche dans l’ordre avec les bons rôles', async () => {
    const first = await request(ctx.app).post('/api/threads/' + bookingId + '/messages').set(lea).send({ body: 'Bonjour, où doit-on se retrouver ?' });
    expect(first.status).toBe(201);
    expect(first.body.authorRole).toBe('traveler');

    const reply = await request(ctx.app).post('/api/admin/threads/' + bookingId + '/messages').set(admin).send({ body: 'Devant le 23 rue Montorgueil à 10h.' });
    expect(reply.status).toBe(201);
    expect(reply.body.authorRole).toBe('concierge');
    expect(reply.body.authorName).toBe('Conciergerie Paris Janitor');

    await request(ctx.app).post('/api/threads/' + bookingId + '/messages').set(lea).send({ body: 'Parfait, merci !' });

    const conversation = await request(ctx.app).get('/api/threads/' + bookingId).set(lea);
    expect(conversation.status).toBe(200);
    expect(conversation.body.thread.subject).toBe('Transfert aéroport');
    expect(conversation.body.messages.map((message: { authorRole: string }) => message.authorRole)).toEqual(['traveler', 'concierge', 'traveler']);
    expect(conversation.body.messages.map((message: { body: string }) => message.body)).toEqual([
      'Bonjour, où doit-on se retrouver ?',
      'Devant le 23 rue Montorgueil à 10h.',
      'Parfait, merci !',
    ]);
  });

  it('le fil apparaît dans la boîte de réception admin avec les messages non lus', async () => {
    const threads = await request(ctx.app).get('/api/admin/threads').set(admin);
    expect(threads.body).toHaveLength(1);
    expect(threads.body[0].bookingId).toBe(bookingId);
    expect(threads.body[0].unreadForAdmin).toBeGreaterThan(0);

    await request(ctx.app).get('/api/admin/threads/' + bookingId).set(admin);
    const afterRead = await request(ctx.app).get('/api/admin/threads').set(admin);
    expect(afterRead.body[0].unreadForAdmin).toBe(0);
  });

  it('un voyageur ne lit ni n’écrit dans le fil d’un autre', async () => {
    const read = await request(ctx.app).get('/api/threads/' + bookingId).set(bob);
    expect(read.status).toBe(403);
    const write = await request(ctx.app).post('/api/threads/' + bookingId + '/messages').set(bob).send({ body: 'Intrusion' });
    expect(write.status).toBe(403);
    expect((await request(ctx.app).get('/api/threads').set(bob)).body).toHaveLength(0);
    expect((await request(ctx.app).get('/api/threads').set(lea)).body).toHaveLength(1);
  });

  it('un message vide est refusé et le fil d’une réservation annulée est fermé', async () => {
    expect((await request(ctx.app).post('/api/threads/' + bookingId + '/messages').set(lea).send({ body: '   ' })).status).toBe(400);

    const booking = await request(ctx.app)
      .post('/api/bookings/services')
      .set(lea)
      .send({ offeringId: fx.fixedOfferingId, qty: 1, scheduledAt });
    await request(ctx.app).post('/api/bookings/services/' + booking.body.id + '/cancel').set(lea);
    const closed = await request(ctx.app).post('/api/threads/' + booking.body.id + '/messages').set(lea).send({ body: 'Encore là ?' });
    expect(closed.status).toBe(409);
    expect(closed.body.error.code).toBe('BOOKING_CANCELLED');
  });
});
