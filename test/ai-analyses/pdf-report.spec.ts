import * as request from 'supertest';
import {
  createTestAppWithAiMock, closeTestApp, getApp, getPrisma,
} from '../helpers/test-app-with-ai-mock';
import { seedUser, seedHospital, loginUser, buildCookieHeader } from '../helpers/auth.helper';
import { cleanDatabase } from '../helpers/cleanup';

describe('AI Analyses - PDF Report', () => {
  let hospitalAId: string;
  let hospitalBId: string;
  let doctorACookies: string[];
  let doctorBCookies: string[];
  let patientCookies: string[];
  let analysisAId: string;
  let analysisBId: string;

  beforeAll(async () => {
    await createTestAppWithAiMock();
    await cleanDatabase(getPrisma());

    hospitalAId = await seedHospital(getPrisma(), { name: 'Hospital A', code: 'HA01' });
    hospitalBId = await seedHospital(getPrisma(), { name: 'Hospital B', code: 'HB01' });

    const doctorA = await seedUser(getPrisma(), { email: 'doctorA@test.com', password: 'Test1234!', role: 'DOCTOR', hospitalId: hospitalAId });
    await seedUser(getPrisma(), { email: 'doctorB@test.com', password: 'Test1234!', role: 'DOCTOR', hospitalId: hospitalBId });
    await seedUser(getPrisma(), { email: 'patient@test.com', password: 'Test1234!', role: 'PATIENT', hospitalId: hospitalAId });

    const natA = await getPrisma().nationalPatient.create({ data: { firstName: 'PA', lastName: 'T', dateOfBirth: new Date('2000-01-01'), gender: 'MALE' } });
    const natB = await getPrisma().nationalPatient.create({ data: { firstName: 'PB', lastName: 'T', dateOfBirth: new Date('2000-01-01'), gender: 'FEMALE' } });
    const profileA = await getPrisma().patientProfile.create({ data: { hospitalId: hospitalAId, nationalPatientId: natA.id } });
    const profileB = await getPrisma().patientProfile.create({ data: { hospitalId: hospitalBId, nationalPatientId: natB.id } });

    const recA = await getPrisma().aIAnalysisResult.create({
      data: {
        hospitalId: hospitalAId, patientProfileId: profileA.id, requestedById: doctorA.id,
        analysisType: 'PNEUMONIA_XRAY', prediction: 'PNEUMONIA', probability: 0.96,
        confidence: 0.96, threshold: 0.94, riskLevel: 'HIGH', modelVersion: 'test-v1',
        analysisMode: 'SINGLE_MODEL',
      },
    });
    const recB = await getPrisma().aIAnalysisResult.create({
      data: {
        hospitalId: hospitalBId, patientProfileId: profileB.id,
        analysisType: 'PNEUMONIA_XRAY', prediction: 'NORMAL', probability: 0.20,
        confidence: 0.80, threshold: 0.94, riskLevel: 'LOW', modelVersion: 'test-v1',
        analysisMode: 'SINGLE_MODEL',
      },
    });
    analysisAId = recA.id;
    analysisBId = recB.id;

    ({ cookies: doctorACookies } = await loginUser(getApp(), 'doctorA@test.com', 'Test1234!'));
    ({ cookies: doctorBCookies } = await loginUser(getApp(), 'doctorB@test.com', 'Test1234!'));
    ({ cookies: patientCookies } = await loginUser(getApp(), 'patient@test.com', 'Test1234!'));
  });

  afterAll(async () => {
    await cleanDatabase(getPrisma());
    await closeTestApp();
  });

  it('should return PDF for same-hospital doctor', async () => {
    const res = await request(getApp().getHttpServer())
      .get(`/api/v1/ai-analyses/${analysisAId}/report/pdf`)
      .set('Cookie', buildCookieHeader(doctorACookies))
      .expect(200);

    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('.pdf');
  });

  it('should block cross-hospital PDF access', async () => {
    // Doctor A tries to download Hospital B analysis
    await request(getApp().getHttpServer())
      .get(`/api/v1/ai-analyses/${analysisBId}/report/pdf`)
      .set('Cookie', buildCookieHeader(doctorACookies))
      .expect(404);
  });

  it('should block unauthenticated PDF access', async () => {
    await request(getApp().getHttpServer())
      .get(`/api/v1/ai-analyses/${analysisAId}/report/pdf`)
      .expect(401);
  });

  it('should block PATIENT role from PDF access', async () => {
    await request(getApp().getHttpServer())
      .get(`/api/v1/ai-analyses/${analysisAId}/report/pdf`)
      .set('Cookie', buildCookieHeader(patientCookies))
      .expect(403);
  });

  it('should accept lang=en query parameter', async () => {
    const res = await request(getApp().getHttpServer())
      .get(`/api/v1/ai-analyses/${analysisAId}/report/pdf?lang=en`)
      .set('Cookie', buildCookieHeader(doctorACookies))
      .expect(200);

    expect(res.headers['content-type']).toContain('application/pdf');
  });

  it('should accept lang=ar query parameter', async () => {
    const res = await request(getApp().getHttpServer())
      .get(`/api/v1/ai-analyses/${analysisAId}/report/pdf?lang=ar`)
      .set('Cookie', buildCookieHeader(doctorACookies))
      .expect(200);

    expect(res.headers['content-type']).toContain('application/pdf');
  });

  it('should fallback to en for invalid lang', async () => {
    const res = await request(getApp().getHttpServer())
      .get(`/api/v1/ai-analyses/${analysisAId}/report/pdf?lang=xx`)
      .set('Cookie', buildCookieHeader(doctorACookies))
      .expect(200);

    expect(res.headers['content-type']).toContain('application/pdf');
  });
});
