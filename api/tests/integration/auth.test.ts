import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../../src/config/env';
import * as userRepository from '../../src/repositories/user.repository';
import { createAdmin, startTestApp, type TestApp } from './setup';

describe('authentification, rôles et format des erreurs', () => {
  let ctx: TestApp;
  let adminToken: string;

  const register = (body: Record<string, unknown>) => request(ctx.app).post('/api/auth/register').send(body);
  const login = (email: string, password: string) => request(ctx.app).post('/api/auth/login').send({ email, password });

  beforeAll(async () => {
    ctx = await startTestApp();
    adminToken = await createAdmin(ctx.app);
  });

  afterAll(() => ctx.stop());

  it('inscrit un voyageur et renvoie un profil sans empreinte de mot de passe', async () => {
    const response = await register({ email: 'Lea.Martin@Example.FR', password: 'motdepasse1', firstName: 'Léa', lastName: 'Martin' });
    expect(response.status).toBe(201);
    expect(response.body.token).toBeTypeOf('string');
    expect(response.body.user).toMatchObject({ email: 'lea.martin@example.fr', role: 'traveler' });
    expect(response.body.user.vip).toMatchObject({ tier: 'free', status: 'none' });
    expect(response.body.user).not.toHaveProperty('passwordHash');

    const me = await request(ctx.app).get('/api/me').set('Authorization', 'Bearer ' + response.body.token);
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(response.body.user.id);
    expect(me.body).not.toHaveProperty('passwordHash');
  });

  it('ne permet pas de s’auto-attribuer le rôle admin à l’inscription', async () => {
    const response = await register({ email: 'pirate@test.fr', password: 'motdepasse1', firstName: 'P', lastName: 'Irate', role: 'admin' });
    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe('traveler');
    const admin = await request(ctx.app).get('/api/admin/users').set('Authorization', 'Bearer ' + response.body.token);
    expect(admin.status).toBe(403);
  });

  it('refuse un e-mail déjà pris, quelle que soit la casse', async () => {
    const duplicate = await register({ email: 'LEA.MARTIN@example.fr', password: 'motdepasse1', firstName: 'Léa', lastName: 'M' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('valide le corps d’inscription et détaille les champs fautifs', async () => {
    const response = await register({ email: 'pas-un-mail', password: '123' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(response.body.error.details)).toEqual(expect.arrayContaining(['email', 'password', 'firstName', 'lastName']));
  });

  it('refuse un mot de passe erroné et un e-mail inconnu avec le même code', async () => {
    const wrongPassword = await login('lea.martin@example.fr', 'mauvais-mot-de-passe');
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');

    const unknown = await login('personne@test.fr', 'motdepasse1');
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('refuse un jeton absent, falsifié ou expiré', async () => {
    const missing = await request(ctx.app).get('/api/me');
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('UNAUTHENTICATED');

    expect((await request(ctx.app).get('/api/me').set('Authorization', 'Token abc')).status).toBe(401);
    expect((await request(ctx.app).get('/api/me').set('Authorization', 'Bearer pas-un-jeton')).status).toBe(401);

    const expired = jwt.sign({ role: 'traveler' }, env.JWT_SECRET, { subject: '000000000000000000000000', expiresIn: -60 });
    expect((await request(ctx.app).get('/api/me').set('Authorization', 'Bearer ' + expired)).status).toBe(401);

    const foreignSecret = jwt.sign({ role: 'admin' }, 'un-autre-secret-suffisamment-long', { subject: '000000000000000000000000' });
    expect((await request(ctx.app).get('/api/me').set('Authorization', 'Bearer ' + foreignSecret)).status).toBe(401);
  });

  it('un jeton valide dont le compte a disparu est refusé', async () => {
    const orphan = jwt.sign({ role: 'traveler' }, env.JWT_SECRET, { subject: '0123456789abcdef01234567' });
    const response = await request(ctx.app).get('/api/me').set('Authorization', 'Bearer ' + orphan);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('un compte bloqué ne peut plus se connecter ni utiliser un jeton déjà émis', async () => {
    const registered = await register({ email: 'bloque@test.fr', password: 'motdepasse1', firstName: 'Bob', lastName: 'Bloqué' });
    const token = registered.body.token;
    expect((await request(ctx.app).get('/api/me').set('Authorization', 'Bearer ' + token)).status).toBe(200);

    await userRepository.updateUser(registered.body.user.id, { blocked: true });

    const blockedLogin = await login('bloque@test.fr', 'motdepasse1');
    expect(blockedLogin.status).toBe(403);
    expect(blockedLogin.body.error.code).toBe('ACCOUNT_BLOCKED');

    const withOldToken = await request(ctx.app).get('/api/me').set('Authorization', 'Bearer ' + token);
    expect(withOldToken.status).toBe(401);
    expect(withOldToken.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('le rôle admin ouvre les routes d’administration', async () => {
    const response = await request(ctx.app).get('/api/admin/users').set('Authorization', 'Bearer ' + adminToken);
    expect(response.status).toBe(200);
    expect(response.body.every((user: Record<string, unknown>) => !('passwordHash' in user))).toBe(true);
  });

  it('une route inconnue renvoie 404 au format contractuel', async () => {
    const response = await request(ctx.app).get('/api/nexiste-pas');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.stringContaining('/api/nexiste-pas') } });
  });
});
