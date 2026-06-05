import * as request from 'supertest';
import { createTestApp, closeTestApp, getApp, getPrisma } from '../helpers/test-app';
import { seedUser, seedHospital, loginUser } from '../helpers/auth.helper';
import { cleanDatabase } from '../helpers/cleanup';

describe('Auth - Login', () => {
  beforeAll(async () => {
    await createTestApp();
    await cleanDatabase(getPrisma());
    const hospitalId = await seedHospital(getPrisma(), { name: 'Test Hospital', code: 'TH01' });
    await seedUser(getPrisma(), {
      email: 'doctor@test.com',
      password: 'Test1234!',
      role: 'DOCTOR',
      hospitalId,
      firstName: 'Test',
      lastName: 'Doctor',
    });
  });

  afterAll(async () => {
    await cleanDatabase(getPrisma());
    await closeTestApp();
  });

  // Run rejection tests FIRST to stay within rate limit
  it('should return 401 on wrong password', async () => {
    await request(getApp().getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'doctor@test.com', password: 'WrongPassword' })
      .expect(401);
  });

  it('should return 401 on nonexistent email', async () => {
    await request(getApp().getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.com', password: 'Test1234!' })
      .expect(401);
  });

  it('should return 200 with user data on valid login', async () => {
    const res = await request(getApp().getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'doctor@test.com', password: 'Test1234!' })
      .expect(200);

    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('doctor@test.com');
    expect(res.body.user.role).toBe('DOCTOR');
    expect(res.body.user.firstName).toBe('Test');
  });

  it('should NOT return accessToken in response body', async () => {
    const res = await request(getApp().getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'doctor@test.com', password: 'Test1234!' })
      .expect(200);

    expect(res.body.accessToken).toBeUndefined();
  });

  it('should set hms_access and hms_refresh HttpOnly cookies', async () => {
    const { accessCookie, refreshCookie } = await loginUser(getApp(), 'doctor@test.com', 'Test1234!');

    expect(accessCookie).toBeTruthy();
    expect(accessCookie).toContain('HttpOnly');
    expect(accessCookie).toContain('Path=/api');

    expect(refreshCookie).toBeTruthy();
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('Path=/api/v1/auth');
  });

  it('should store refresh token hash in database', async () => {
    const tokens = await getPrisma().refreshToken.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    expect(tokens.length).toBe(1);
    expect(tokens[0].tokenHash).toBeDefined();
    expect(tokens[0].familyId).toBeDefined();
    expect(tokens[0].revokedAt).toBeNull();
  });
});
