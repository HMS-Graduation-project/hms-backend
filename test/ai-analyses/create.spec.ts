import * as request from 'supertest';
import {
  createTestAppWithAiMock, closeTestApp, getApp, getPrisma, getMockAiService,
} from '../helpers/test-app-with-ai-mock';
import { seedUser, seedHospital, loginUser, buildCookieHeader } from '../helpers/auth.helper';
import { cleanDatabase } from '../helpers/cleanup';
import { TEST_JPEG_BUFFER, MOCK_ENSEMBLE_RESULT } from '../helpers/ai-mock';

describe('AI Analyses - Create', () => {
  let doctorCookies: string[];
  let patientProfileId: string;
  let hospitalId: string;

  beforeAll(async () => {
    await createTestAppWithAiMock();
    await cleanDatabase(getPrisma());

    hospitalId = await seedHospital(getPrisma(), { name: 'Test Hospital', code: 'TH01' });
    await seedUser(getPrisma(), {
      email: 'doctor@test.com',
      password: 'Test1234!',
      role: 'DOCTOR',
      hospitalId,
    });

    const national = await getPrisma().nationalPatient.create({
      data: { firstName: 'Test', lastName: 'Patient', dateOfBirth: new Date('2000-01-01'), gender: 'MALE' },
    });
    const profile = await getPrisma().patientProfile.create({
      data: { hospitalId, nationalPatientId: national.id },
    });
    patientProfileId = profile.id;

    ({ cookies: doctorCookies } = await loginUser(getApp(), 'doctor@test.com', 'Test1234!'));
  });

  afterAll(async () => {
    await cleanDatabase(getPrisma());
    await closeTestApp();
  });

  it('should create single-model analysis and save DB record', async () => {
    const res = await request(getApp().getHttpServer())
      .post('/api/v1/ai-analyses/pneumonia')
      .set('Cookie', buildCookieHeader(doctorCookies))
      .attach('file', TEST_JPEG_BUFFER, { filename: 'xray.jpg', contentType: 'image/jpeg' })
      .field('patientProfileId', patientProfileId)
      .field('includeGradcam', 'false')
      .field('analysisMode', 'SINGLE_MODEL')
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.prediction).toBe('PNEUMONIA');
    expect(res.body.probability).toBe(0.9512);
    expect(res.body.analysisMode).toBe('SINGLE_MODEL');
    expect(res.body.status).toBe('PENDING_REVIEW');
    expect(res.body.originalImageUrl).toContain('/uploads/ai/pneumonia/');
    expect(getMockAiService().pneumoniaPredict).toHaveBeenCalled();
  });

  it('should create ensemble analysis and save ensemble metadata', async () => {
    const res = await request(getApp().getHttpServer())
      .post('/api/v1/ai-analyses/pneumonia')
      .set('Cookie', buildCookieHeader(doctorCookies))
      .attach('file', TEST_JPEG_BUFFER, { filename: 'xray.jpg', contentType: 'image/jpeg' })
      .field('patientProfileId', patientProfileId)
      .field('includeGradcam', 'true')
      .field('analysisMode', 'ENSEMBLE')
      .expect(201);

    expect(res.body.analysisMode).toBe('ENSEMBLE');
    expect(res.body.modelVersion).toBe('pneumonia-ensemble-v1');
    expect(res.body.ensembleMethod).toBe('WEIGHTED_AVERAGE');
    expect(res.body.modelAgreement).toBe('STRONG');
    expect(res.body.agreementScore).toBe(1.0);
    expect(getMockAiService().pneumoniaEnsemble).toHaveBeenCalled();

    // Verify individual model results are persisted
    const record = await getPrisma().aIAnalysisResult.findUnique({
      where: { id: res.body.id },
    });
    expect(record?.modelResultsJson).toBeDefined();
    expect(Array.isArray(record?.modelResultsJson)).toBe(true);
    expect((record?.modelResultsJson as any[]).length).toBe(3);
  });

  it('should set initial status to PENDING_REVIEW', async () => {
    const res = await request(getApp().getHttpServer())
      .post('/api/v1/ai-analyses/pneumonia')
      .set('Cookie', buildCookieHeader(doctorCookies))
      .attach('file', TEST_JPEG_BUFFER, { filename: 'xray.jpg', contentType: 'image/jpeg' })
      .field('patientProfileId', patientProfileId)
      .field('analysisMode', 'SINGLE_MODEL')
      .expect(201);

    expect(res.body.status).toBe('PENDING_REVIEW');
  });

  it('should reject invalid MIME type', async () => {
    await request(getApp().getHttpServer())
      .post('/api/v1/ai-analyses/pneumonia')
      .set('Cookie', buildCookieHeader(doctorCookies))
      .attach('file', Buffer.from('not an image'), { filename: 'test.txt', contentType: 'text/plain' })
      .field('patientProfileId', patientProfileId)
      .expect(400);
  });

  it('should reject missing file', async () => {
    await request(getApp().getHttpServer())
      .post('/api/v1/ai-analyses/pneumonia')
      .set('Cookie', buildCookieHeader(doctorCookies))
      .field('patientProfileId', patientProfileId)
      .expect(400);
  });

  it('should reject patient from a different hospital', async () => {
    const otherHospitalId = await seedHospital(getPrisma(), { name: 'Other Hospital', code: 'OH01' });
    const otherNat = await getPrisma().nationalPatient.create({
      data: { firstName: 'Other', lastName: 'Patient', dateOfBirth: new Date('2000-01-01'), gender: 'FEMALE' },
    });
    const otherProfile = await getPrisma().patientProfile.create({
      data: { hospitalId: otherHospitalId, nationalPatientId: otherNat.id },
    });

    await request(getApp().getHttpServer())
      .post('/api/v1/ai-analyses/pneumonia')
      .set('Cookie', buildCookieHeader(doctorCookies))
      .attach('file', TEST_JPEG_BUFFER, { filename: 'xray.jpg', contentType: 'image/jpeg' })
      .field('patientProfileId', otherProfile.id)
      .field('analysisMode', 'SINGLE_MODEL')
      .expect(404);
  });
});
