import * as request from 'supertest';
import {
  createTestAppWithAiMock, closeTestApp, getApp, getPrisma,
} from '../helpers/test-app-with-ai-mock';
import { seedUser, seedHospital, loginUser, buildCookieHeader } from '../helpers/auth.helper';
import { cleanDatabase } from '../helpers/cleanup';

describe('AI Analyses - Review Workflow', () => {
  let doctorCookies: string[];
  let hospitalId: string;
  let doctorId: string;

  async function createAnalysis(prediction = 'PNEUMONIA', prob = 0.95) {
    const national = await getPrisma().nationalPatient.create({
      data: { firstName: 'P', lastName: 'Test', dateOfBirth: new Date('2000-01-01'), gender: 'MALE' },
    });
    const profile = await getPrisma().patientProfile.create({
      data: { hospitalId, nationalPatientId: national.id },
    });
    return getPrisma().aIAnalysisResult.create({
      data: {
        hospitalId,
        patientProfileId: profile.id,
        requestedById: doctorId,
        analysisType: 'PNEUMONIA_XRAY',
        prediction,
        probability: prob,
        confidence: prob,
        threshold: 0.94,
        riskLevel: prob >= 0.94 ? 'HIGH' : 'ELEVATED',
        modelVersion: 'test-v1',
        analysisMode: 'SINGLE_MODEL',
      },
    });
  }

  beforeAll(async () => {
    await createTestAppWithAiMock();
    await cleanDatabase(getPrisma());

    hospitalId = await seedHospital(getPrisma(), { name: 'Test Hospital', code: 'TH01' });
    const doctor = await seedUser(getPrisma(), {
      email: 'doctor@test.com',
      password: 'Test1234!',
      role: 'DOCTOR',
      hospitalId,
    });
    doctorId = doctor.id;

    ({ cookies: doctorCookies } = await loginUser(getApp(), 'doctor@test.com', 'Test1234!'));
  });

  afterAll(async () => {
    await cleanDatabase(getPrisma());
    await closeTestApp();
  });

  it('should transition PENDING_REVIEW → REVIEWED', async () => {
    const analysis = await createAnalysis();

    const res = await request(getApp().getHttpServer())
      .patch(`/api/v1/ai-analyses/${analysis.id}/review`)
      .set('Cookie', buildCookieHeader(doctorCookies))
      .send({ status: 'REVIEWED', doctorComment: 'Looks consistent.' })
      .expect(200);

    expect(res.body.status).toBe('REVIEWED');
    expect(res.body.doctorComment).toBe('Looks consistent.');
    expect(res.body.reviewedBy).toBeDefined();
    expect(res.body.reviewedAt).toBeDefined();
  });

  it('should transition PENDING_REVIEW → APPROVED', async () => {
    const analysis = await createAnalysis();

    const res = await request(getApp().getHttpServer())
      .patch(`/api/v1/ai-analyses/${analysis.id}/review`)
      .set('Cookie', buildCookieHeader(doctorCookies))
      .send({ status: 'APPROVED' })
      .expect(200);

    expect(res.body.status).toBe('APPROVED');
  });

  it('should transition PENDING_REVIEW → REJECTED with comment', async () => {
    const analysis = await createAnalysis();

    const res = await request(getApp().getHttpServer())
      .patch(`/api/v1/ai-analyses/${analysis.id}/review`)
      .set('Cookie', buildCookieHeader(doctorCookies))
      .send({ status: 'REJECTED', doctorComment: 'False positive — clinical presentation inconsistent.' })
      .expect(200);

    expect(res.body.status).toBe('REJECTED');
    expect(res.body.doctorComment).toBe('False positive — clinical presentation inconsistent.');
  });

  it('should transition REVIEWED → APPROVED', async () => {
    const analysis = await createAnalysis();
    // First transition to REVIEWED
    await request(getApp().getHttpServer())
      .patch(`/api/v1/ai-analyses/${analysis.id}/review`)
      .set('Cookie', buildCookieHeader(doctorCookies))
      .send({ status: 'REVIEWED' })
      .expect(200);

    // Then approve
    const res = await request(getApp().getHttpServer())
      .patch(`/api/v1/ai-analyses/${analysis.id}/review`)
      .set('Cookie', buildCookieHeader(doctorCookies))
      .send({ status: 'APPROVED', doctorComment: 'Confirmed by physician.' })
      .expect(200);

    expect(res.body.status).toBe('APPROVED');
  });

  it('should reject invalid transition APPROVED → REJECTED', async () => {
    const analysis = await createAnalysis();
    // Approve first
    await request(getApp().getHttpServer())
      .patch(`/api/v1/ai-analyses/${analysis.id}/review`)
      .set('Cookie', buildCookieHeader(doctorCookies))
      .send({ status: 'APPROVED' })
      .expect(200);

    // Try to reject after approval
    await request(getApp().getHttpServer())
      .patch(`/api/v1/ai-analyses/${analysis.id}/review`)
      .set('Cookie', buildCookieHeader(doctorCookies))
      .send({ status: 'REJECTED', doctorComment: 'Too late' })
      .expect(400);
  });

  it('should NOT overwrite original AI prediction on review', async () => {
    const analysis = await createAnalysis('PNEUMONIA', 0.9512);

    await request(getApp().getHttpServer())
      .patch(`/api/v1/ai-analyses/${analysis.id}/review`)
      .set('Cookie', buildCookieHeader(doctorCookies))
      .send({ status: 'REJECTED', doctorComment: 'Disagree with AI' })
      .expect(200);

    // Verify original AI fields are unchanged
    const record = await getPrisma().aIAnalysisResult.findUnique({
      where: { id: analysis.id },
    });
    expect(record?.prediction).toBe('PNEUMONIA');
    expect(record?.probability).toBe(0.9512);
    expect(record?.modelVersion).toBe('test-v1');
    // Only review fields changed
    expect(record?.status).toBe('REJECTED');
    expect(record?.doctorComment).toBe('Disagree with AI');
    expect(record?.reviewedById).toBe(doctorId);
  });

  it('should return 404 for nonexistent analysis', async () => {
    await request(getApp().getHttpServer())
      .patch('/api/v1/ai-analyses/00000000-0000-0000-0000-000000000000/review')
      .set('Cookie', buildCookieHeader(doctorCookies))
      .send({ status: 'APPROVED' })
      .expect(404);
  });
});
