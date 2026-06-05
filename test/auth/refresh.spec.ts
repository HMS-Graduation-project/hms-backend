import * as request from 'supertest';
import { createTestApp, closeTestApp, getApp, getPrisma } from '../helpers/test-app';
import {
  seedUser, seedHospital, loginUser,
  extractCookieValue, buildCookieHeader,
} from '../helpers/auth.helper';
import { cleanDatabase } from '../helpers/cleanup';

describe('Auth - Refresh Token Rotation', () => {
  beforeAll(async () => {
    await createTestApp();
    await cleanDatabase(getPrisma());
    const hospitalId = await seedHospital(getPrisma(), { name: 'Test Hospital', code: 'TH01' });
    await seedUser(getPrisma(), {
      email: 'doctor@test.com',
      password: 'Test1234!',
      role: 'DOCTOR',
      hospitalId,
    });
  });

  afterAll(async () => {
    await cleanDatabase(getPrisma());
    await closeTestApp();
  });

  beforeEach(async () => {
    await getPrisma().refreshToken.deleteMany();
  });

  it('should rotate refresh token and return new cookies', async () => {
    const { cookies } = await loginUser(getApp(), 'doctor@test.com', 'Test1234!');

    const res = await request(getApp().getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', buildCookieHeader(cookies))
      .expect(200);

    const newCookies = ([] as string[]).concat(res.headers['set-cookie'] || []);
    const newAccess = newCookies.find((c) => c.startsWith('hms_access='));
    const newRefresh = newCookies.find((c) => c.startsWith('hms_refresh='));

    expect(newAccess).toBeTruthy();
    expect(newRefresh).toBeTruthy();
    expect(res.body.user).toBeDefined();
  });

  it('should revoke old refresh token after rotation', async () => {
    const { cookies } = await loginUser(getApp(), 'doctor@test.com', 'Test1234!');

    await request(getApp().getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', buildCookieHeader(cookies))
      .expect(200);

    const tokens = await getPrisma().refreshToken.findMany({
      orderBy: { createdAt: 'asc' },
    });

    expect(tokens.length).toBe(2);
    expect(tokens[0].revokedAt).not.toBeNull(); // old revoked
    expect(tokens[1].revokedAt).toBeNull(); // new active
    expect(tokens[0].familyId).toBe(tokens[1].familyId); // same family
  });

  it('should revoke entire token family on reuse of old refresh token', async () => {
    // Login: get original refresh token
    const { cookies: originalCookies } = await loginUser(getApp(), 'doctor@test.com', 'Test1234!');

    // Rotate once: original token is now revoked
    await request(getApp().getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', buildCookieHeader(originalCookies))
      .expect(200);

    // Reuse the original (now-revoked) token — should trigger family revocation
    await request(getApp().getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', buildCookieHeader(originalCookies))
      .expect(401);

    // ALL tokens in the family should be revoked
    const tokens = await getPrisma().refreshToken.findMany();
    const active = tokens.filter((t) => t.revokedAt === null);
    expect(active.length).toBe(0);
  });

  it('should return 401 when no refresh cookie is present', async () => {
    await request(getApp().getHttpServer())
      .post('/api/v1/auth/refresh')
      .expect(401);
  });

  it('should return 401 with fabricated refresh token', async () => {
    await request(getApp().getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'hms_refresh=fake-token-value')
      .expect(401);
  });
});
