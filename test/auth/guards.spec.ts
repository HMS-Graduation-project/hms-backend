import * as request from 'supertest';
import { createTestApp, closeTestApp, getApp, getPrisma } from '../helpers/test-app';
import { seedUser, seedHospital, loginUser, buildCookieHeader } from '../helpers/auth.helper';
import { cleanDatabase } from '../helpers/cleanup';

describe('Auth - Guards & Protected Routes', () => {
  let doctorCookies: string[];
  let patientCookies: string[];
  let adminCookies: string[];

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
    await seedUser(getPrisma(), {
      email: 'patient@test.com',
      password: 'Test1234!',
      role: 'PATIENT',
      hospitalId,
    });
    await seedUser(getPrisma(), {
      email: 'admin@test.com',
      password: 'Test1234!',
      role: 'SUPER_ADMIN',
    });

    ({ cookies: doctorCookies } = await loginUser(getApp(), 'doctor@test.com', 'Test1234!'));
    ({ cookies: patientCookies } = await loginUser(getApp(), 'patient@test.com', 'Test1234!'));
    ({ cookies: adminCookies } = await loginUser(getApp(), 'admin@test.com', 'Test1234!'));
  });

  afterAll(async () => {
    await cleanDatabase(getPrisma());
    await closeTestApp();
  });

  it('should reject unauthenticated requests to protected endpoints', async () => {
    await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses')
      .expect(401);
  });

  it('should accept authenticated DOCTOR accessing AI analyses', async () => {
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses')
      .set('Cookie', buildCookieHeader(doctorCookies));

    expect(res.status).toBe(200);
  });

  it('should reject PATIENT accessing AI analyses (role guard)', async () => {
    await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses')
      .set('Cookie', buildCookieHeader(patientCookies))
      .expect(403);
  });

  it('should allow SUPER_ADMIN accessing AI analyses', async () => {
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses')
      .set('Cookie', buildCookieHeader(adminCookies));

    expect(res.status).toBe(200);
  });

  it('should allow DOCTOR accessing AI analytics', async () => {
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(doctorCookies));

    expect(res.status).toBe(200);
  });

  it('should reject PATIENT accessing AI analytics', async () => {
    await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(patientCookies))
      .expect(403);
  });
});
