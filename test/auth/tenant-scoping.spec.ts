import * as request from 'supertest';
import { createTestApp, closeTestApp, getApp, getPrisma } from '../helpers/test-app';
import { seedUser, seedHospital, loginUser, buildCookieHeader } from '../helpers/auth.helper';
import { cleanDatabase } from '../helpers/cleanup';

describe('Auth - Tenant Scoping', () => {
  let hospitalAId: string;
  let hospitalBId: string;
  let doctorACookies: string[];
  let doctorBCookies: string[];
  let superAdminCookies: string[];
  let analysisAId: string;
  let analysisBId: string;

  beforeAll(async () => {
    await createTestApp();
    await cleanDatabase(getPrisma());

    hospitalAId = await seedHospital(getPrisma(), { name: 'Hospital A', code: 'HA01' });
    hospitalBId = await seedHospital(getPrisma(), { name: 'Hospital B', code: 'HB01' });

    const doctorA = await seedUser(getPrisma(), {
      email: 'doctorA@test.com',
      password: 'Test1234!',
      role: 'DOCTOR',
      hospitalId: hospitalAId,
    });
    await seedUser(getPrisma(), {
      email: 'doctorB@test.com',
      password: 'Test1234!',
      role: 'DOCTOR',
      hospitalId: hospitalBId,
    });
    await seedUser(getPrisma(), {
      email: 'superadmin@test.com',
      password: 'Test1234!',
      role: 'SUPER_ADMIN',
    });

    // Create national patients and profiles for each hospital
    const nationalA = await getPrisma().nationalPatient.create({
      data: { firstName: 'PatientA', lastName: 'Test', dateOfBirth: new Date('2000-01-01'), gender: 'MALE' },
    });
    const nationalB = await getPrisma().nationalPatient.create({
      data: { firstName: 'PatientB', lastName: 'Test', dateOfBirth: new Date('2000-01-01'), gender: 'FEMALE' },
    });
    const patientA = await getPrisma().patientProfile.create({
      data: {
        hospitalId: hospitalAId,
        nationalPatientId: nationalA.id,
      },
    });
    const patientB = await getPrisma().patientProfile.create({
      data: {
        hospitalId: hospitalBId,
        nationalPatientId: nationalB.id,
      },
    });

    // Create AI analysis records in each hospital
    const recA = await getPrisma().aIAnalysisResult.create({
      data: {
        hospitalId: hospitalAId,
        patientProfileId: patientA.id,
        requestedById: doctorA.id,
        analysisType: 'PNEUMONIA_XRAY',
        prediction: 'PNEUMONIA',
        probability: 0.95,
        confidence: 0.95,
        threshold: 0.94,
        riskLevel: 'HIGH',
        modelVersion: 'test-v1',
        analysisMode: 'SINGLE_MODEL',
      },
    });
    const recB = await getPrisma().aIAnalysisResult.create({
      data: {
        hospitalId: hospitalBId,
        patientProfileId: patientB.id,
        analysisType: 'PNEUMONIA_XRAY',
        prediction: 'NORMAL',
        probability: 0.20,
        confidence: 0.80,
        threshold: 0.94,
        riskLevel: 'LOW',
        modelVersion: 'test-v1',
        analysisMode: 'SINGLE_MODEL',
      },
    });
    analysisAId = recA.id;
    analysisBId = recB.id;

    ({ cookies: doctorACookies } = await loginUser(getApp(), 'doctorA@test.com', 'Test1234!'));
    ({ cookies: doctorBCookies } = await loginUser(getApp(), 'doctorB@test.com', 'Test1234!'));
    ({ cookies: superAdminCookies } = await loginUser(getApp(), 'superadmin@test.com', 'Test1234!'));
  });

  afterAll(async () => {
    await cleanDatabase(getPrisma());
    await closeTestApp();
  });

  it('Doctor A should only see Hospital A analyses', async () => {
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses')
      .set('Cookie', buildCookieHeader(doctorACookies))
      .expect(200);

    const ids = res.body.data.map((r: any) => r.id);
    expect(ids).toContain(analysisAId);
    expect(ids).not.toContain(analysisBId);
  });

  it('Doctor B should only see Hospital B analyses', async () => {
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses')
      .set('Cookie', buildCookieHeader(doctorBCookies))
      .expect(200);

    const ids = res.body.data.map((r: any) => r.id);
    expect(ids).toContain(analysisBId);
    expect(ids).not.toContain(analysisAId);
  });

  it('Doctor A cannot access Hospital B analysis by ID', async () => {
    const res = await request(getApp().getHttpServer())
      .get(`/api/v1/ai-analyses/${analysisBId}`)
      .set('Cookie', buildCookieHeader(doctorACookies));

    // Tenant middleware converts findUnique to findFirst with hospitalId filter,
    // so this returns 404 (not found in scoped view)
    expect(res.status).toBe(404);
  });

  it('Analytics should be scoped to own hospital for Doctor A', async () => {
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(doctorACookies))
      .expect(200);

    expect(res.body.overview.totalAnalyses).toBe(1);
    expect(res.body.overview.positiveResults).toBe(1); // Hospital A has PNEUMONIA
  });

  it('Analytics should be scoped to own hospital for Doctor B', async () => {
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(doctorBCookies))
      .expect(200);

    expect(res.body.overview.totalAnalyses).toBe(1);
    expect(res.body.overview.negativeResults).toBe(1); // Hospital B has NORMAL
  });
});
