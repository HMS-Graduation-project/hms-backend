import * as request from 'supertest';
import { createTestApp, closeTestApp, getApp, getPrisma } from '../helpers/test-app';
import { seedUser, seedHospital, loginUser, buildCookieHeader } from '../helpers/auth.helper';
import { cleanDatabase } from '../helpers/cleanup';

describe('Auth - Logout', () => {
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

  it('should return 204 and clear cookies', async () => {
    const { cookies } = await loginUser(getApp(), 'doctor@test.com', 'Test1234!');

    const res = await request(getApp().getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', buildCookieHeader(cookies))
      .expect(204);

    const resCookies = ([] as string[]).concat(res.headers['set-cookie'] || []);
    const clearedAccess = resCookies.find((c) => c.startsWith('hms_access='));
    const clearedRefresh = resCookies.find((c) => c.startsWith('hms_refresh='));

    // Cookies should be cleared (expired or empty)
    expect(clearedAccess).toBeTruthy();
    expect(clearedRefresh).toBeTruthy();
  });

  it('should revoke all tokens in the family', async () => {
    const { cookies } = await loginUser(getApp(), 'doctor@test.com', 'Test1234!');

    await request(getApp().getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', buildCookieHeader(cookies))
      .expect(204);

    const tokens = await getPrisma().refreshToken.findMany();
    const active = tokens.filter((t) => t.revokedAt === null);
    expect(active.length).toBe(0);
  });

  it('should prevent refresh after logout', async () => {
    const { cookies } = await loginUser(getApp(), 'doctor@test.com', 'Test1234!');

    // Logout
    await request(getApp().getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', buildCookieHeader(cookies))
      .expect(204);

    // Attempt refresh with old cookies
    await request(getApp().getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', buildCookieHeader(cookies))
      .expect(401);
  });
});
