import * as request from 'supertest';
import {
  createTestAppWithAiMock, closeTestApp, getApp, getPrisma,
} from '../helpers/test-app-with-ai-mock';
import { seedUser, seedHospital, loginUser, buildCookieHeader } from '../helpers/auth.helper';
import { cleanDatabase } from '../helpers/cleanup';

/**
 * Deterministic analytics seed data.
 *
 * Hospital A — 10 records:
 *   PNEUMONIA + APPROVED  = TP x4
 *   PNEUMONIA + REJECTED  = FP x1
 *   NORMAL   + APPROVED   = TN x3
 *   NORMAL   + REJECTED   = FN x2
 *
 * Expected clinical performance:
 *   TP=4, FP=1, TN=3, FN=2, total=10
 *   Sensitivity = 4/(4+2) = 0.6667
 *   Specificity = 3/(3+1) = 0.75
 *   Precision   = 4/(4+1) = 0.8
 *   Accuracy    = (4+3)/10 = 0.7
 *
 * Risk distribution: LOW=2, MODERATE=3, ELEVATED=2, HIGH=3
 * Mode: SINGLE_MODEL=6, ENSEMBLE=4
 *
 * Hospital B — 2 records (must NOT appear in Hospital A analytics)
 */
describe('AI Analyses - Analytics', () => {
  let hospitalAId: string;
  let hospitalBId: string;
  let doctorACookies: string[];
  let doctorBCookies: string[];
  let patientCookies: string[];

  async function seedAnalysis(
    hospitalId: string,
    requestedById: string,
    patientProfileId: string,
    overrides: {
      prediction: string;
      probability: number;
      riskLevel: string;
      status: string;
      analysisMode?: string;
      modelAgreement?: string;
      agreementScore?: number;
      modelResultsJson?: any;
    },
  ) {
    return getPrisma().aIAnalysisResult.create({
      data: {
        hospitalId,
        patientProfileId,
        requestedById,
        analysisType: 'PNEUMONIA_XRAY',
        prediction: overrides.prediction,
        probability: overrides.probability,
        confidence: overrides.probability,
        threshold: 0.94,
        riskLevel: overrides.riskLevel,
        modelVersion: overrides.analysisMode === 'ENSEMBLE' ? 'pneumonia-ensemble-v1' : 'pneumonia-densenet121-v2',
        device: 'cpu',
        analysisMode: overrides.analysisMode || 'SINGLE_MODEL',
        status: overrides.status as any,
        modelAgreement: overrides.modelAgreement || null,
        agreementScore: overrides.agreementScore ?? null,
        modelResultsJson: overrides.modelResultsJson || null,
        reviewedAt: ['APPROVED', 'REJECTED', 'REVIEWED'].includes(overrides.status)
          ? new Date() : null,
      },
    });
  }

  beforeAll(async () => {
    await createTestAppWithAiMock();
    await cleanDatabase(getPrisma());

    hospitalAId = await seedHospital(getPrisma(), { name: 'Hospital A', code: 'HA01' });
    hospitalBId = await seedHospital(getPrisma(), { name: 'Hospital B', code: 'HB01' });

    const doctorA = await seedUser(getPrisma(), { email: 'doctorA@test.com', password: 'Test1234!', role: 'DOCTOR', hospitalId: hospitalAId });
    const doctorB = await seedUser(getPrisma(), { email: 'doctorB@test.com', password: 'Test1234!', role: 'DOCTOR', hospitalId: hospitalBId });
    await seedUser(getPrisma(), { email: 'patient@test.com', password: 'Test1234!', role: 'PATIENT', hospitalId: hospitalAId });

    // Create patients
    const natA = await getPrisma().nationalPatient.create({ data: { firstName: 'PA', lastName: 'T', dateOfBirth: new Date('2000-01-01'), gender: 'MALE' } });
    const natB = await getPrisma().nationalPatient.create({ data: { firstName: 'PB', lastName: 'T', dateOfBirth: new Date('2000-01-01'), gender: 'FEMALE' } });
    const profileA = await getPrisma().patientProfile.create({ data: { hospitalId: hospitalAId, nationalPatientId: natA.id } });
    const profileB = await getPrisma().patientProfile.create({ data: { hospitalId: hospitalBId, nationalPatientId: natB.id } });

    const ensembleModels = [
      { modelName: 'DenseNet121', modelVersion: 'v2', prediction: 'NORMAL', probability: 0.72, confidence: 0.72, threshold: 0.94, isPositive: false, device: 'cpu' },
      { modelName: 'EfficientNet-B0', modelVersion: 'v1', prediction: 'NORMAL', probability: 0.81, confidence: 0.81, threshold: 0.94, isPositive: false, device: 'cpu' },
      { modelName: 'ResNet50', modelVersion: 'v1', prediction: 'NORMAL', probability: 0.75, confidence: 0.75, threshold: 0.94, isPositive: false, device: 'cpu' },
    ];

    // Hospital A: 10 records
    // TP: PNEUMONIA + APPROVED (x4) — HIGH risk
    await seedAnalysis(hospitalAId, doctorA.id, profileA.id, { prediction: 'PNEUMONIA', probability: 0.96, riskLevel: 'HIGH', status: 'APPROVED' });
    await seedAnalysis(hospitalAId, doctorA.id, profileA.id, { prediction: 'PNEUMONIA', probability: 0.97, riskLevel: 'HIGH', status: 'APPROVED' });
    await seedAnalysis(hospitalAId, doctorA.id, profileA.id, { prediction: 'PNEUMONIA', probability: 0.95, riskLevel: 'HIGH', status: 'APPROVED' });
    await seedAnalysis(hospitalAId, doctorA.id, profileA.id, { prediction: 'PNEUMONIA', probability: 0.94, riskLevel: 'ELEVATED', status: 'APPROVED', analysisMode: 'ENSEMBLE', modelAgreement: 'STRONG', agreementScore: 1.0, modelResultsJson: ensembleModels });

    // FP: PNEUMONIA + REJECTED (x1)
    await seedAnalysis(hospitalAId, doctorA.id, profileA.id, { prediction: 'PNEUMONIA', probability: 0.95, riskLevel: 'ELEVATED', status: 'REJECTED' });

    // TN: NORMAL + APPROVED (x3)
    await seedAnalysis(hospitalAId, doctorA.id, profileA.id, { prediction: 'NORMAL', probability: 0.15, riskLevel: 'LOW', status: 'APPROVED', analysisMode: 'ENSEMBLE', modelAgreement: 'STRONG', agreementScore: 1.0, modelResultsJson: ensembleModels });
    await seedAnalysis(hospitalAId, doctorA.id, profileA.id, { prediction: 'NORMAL', probability: 0.20, riskLevel: 'LOW', status: 'APPROVED' });
    await seedAnalysis(hospitalAId, doctorA.id, profileA.id, { prediction: 'NORMAL', probability: 0.45, riskLevel: 'MODERATE', status: 'APPROVED', analysisMode: 'ENSEMBLE', modelAgreement: 'MODERATE', agreementScore: 0.67, modelResultsJson: ensembleModels });

    // FN: NORMAL + REJECTED (x2)
    await seedAnalysis(hospitalAId, doctorA.id, profileA.id, { prediction: 'NORMAL', probability: 0.50, riskLevel: 'MODERATE', status: 'REJECTED' });
    await seedAnalysis(hospitalAId, doctorA.id, profileA.id, { prediction: 'NORMAL', probability: 0.55, riskLevel: 'MODERATE', status: 'REJECTED', analysisMode: 'ENSEMBLE', modelAgreement: 'LOW', agreementScore: 0.33, modelResultsJson: ensembleModels });

    // Hospital B: 2 records (should NOT appear in Hospital A analytics)
    await seedAnalysis(hospitalBId, doctorB.id, profileB.id, { prediction: 'PNEUMONIA', probability: 0.98, riskLevel: 'HIGH', status: 'APPROVED' });
    await seedAnalysis(hospitalBId, doctorB.id, profileB.id, { prediction: 'NORMAL', probability: 0.10, riskLevel: 'LOW', status: 'PENDING_REVIEW' });

    ({ cookies: doctorACookies } = await loginUser(getApp(), 'doctorA@test.com', 'Test1234!'));
    ({ cookies: doctorBCookies } = await loginUser(getApp(), 'doctorB@test.com', 'Test1234!'));
    ({ cookies: patientCookies } = await loginUser(getApp(), 'patient@test.com', 'Test1234!'));
  });

  afterAll(async () => {
    await cleanDatabase(getPrisma());
    await closeTestApp();
  });

  // ── Overview KPIs ────────────────────────────────────────────────

  it('should return correct overview counts for Hospital A', async () => {
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(doctorACookies))
      .expect(200);

    const ov = res.body.overview;
    expect(ov.totalAnalyses).toBe(10);
    expect(ov.positiveResults).toBe(5);   // 4 TP + 1 FP
    expect(ov.negativeResults).toBe(5);   // 3 TN + 2 FN
    expect(ov.pendingReview).toBe(0);
    expect(ov.approved).toBe(7);          // 4 TP + 3 TN
    expect(ov.rejected).toBe(3);          // 1 FP + 2 FN
    expect(ov.ensembleAnalyses).toBe(4);
    expect(ov.singleModelAnalyses).toBe(6);
  });

  // ── Prediction Distribution ──────────────────────────────────────

  it('should return correct prediction distribution', async () => {
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(doctorACookies))
      .expect(200);

    expect(res.body.distribution.prediction.PNEUMONIA).toBe(5);
    expect(res.body.distribution.prediction.NORMAL).toBe(5);
  });

  // ── Risk Distribution ────────────────────────────────────────────

  it('should return correct risk distribution', async () => {
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(doctorACookies))
      .expect(200);

    const risk = res.body.distribution.riskLevel;
    expect(risk.LOW).toBe(2);
    expect(risk.MODERATE).toBe(3);
    expect(risk.ELEVATED).toBe(2);
    expect(risk.HIGH).toBe(3);
  });

  // ── Status Distribution ──────────────────────────────────────────

  it('should return correct status distribution', async () => {
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(doctorACookies))
      .expect(200);

    const status = res.body.distribution.status;
    expect(status.APPROVED).toBe(7);  // 4 TP + 3 TN
    expect(status.REJECTED).toBe(3);  // 1 FP + 2 FN
  });

  // ── Analysis Mode Distribution ───────────────────────────────────

  it('should return correct analysis mode distribution', async () => {
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(doctorACookies))
      .expect(200);

    const mode = res.body.distribution.analysisMode;
    expect(mode.SINGLE_MODEL).toBe(6);
    expect(mode.ENSEMBLE).toBe(4);
  });

  // ── Clinical Performance ─────────────────────────────────────────

  it('should calculate TP/FP/TN/FN correctly', async () => {
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(doctorACookies))
      .expect(200);

    const cp = res.body.clinicalPerformance;
    expect(cp.truePositive).toBe(4);
    expect(cp.falsePositive).toBe(1);
    expect(cp.trueNegative).toBe(3);
    expect(cp.falseNegative).toBe(2);
    expect(cp.reviewedRecords).toBe(10);
  });

  it('should calculate sensitivity correctly: TP/(TP+FN)', async () => {
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(doctorACookies))
      .expect(200);

    // Sensitivity = 4 / (4+2) = 0.6667
    expect(res.body.clinicalPerformance.sensitivityEstimate).toBeCloseTo(4 / 6, 3);
  });

  it('should calculate specificity correctly: TN/(TN+FP)', async () => {
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(doctorACookies))
      .expect(200);

    // Specificity = 3 / (3+1) = 0.75
    expect(res.body.clinicalPerformance.specificityEstimate).toBeCloseTo(3 / 4, 3);
  });

  it('should calculate precision correctly: TP/(TP+FP)', async () => {
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(doctorACookies))
      .expect(200);

    // Precision = 4 / (4+1) = 0.8
    expect(res.body.clinicalPerformance.precisionEstimate).toBeCloseTo(4 / 5, 3);
  });

  it('should calculate accuracy correctly: (TP+TN)/Total', async () => {
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(doctorACookies))
      .expect(200);

    // Accuracy = (4+3) / 10 = 0.7
    expect(res.body.clinicalPerformance.accuracyEstimate).toBeCloseTo(7 / 10, 3);
  });

  // ── Division-by-Zero Safety ──────────────────────────────────────

  it('should return null metrics when no reviewed records exist', async () => {
    // Hospital B has 1 APPROVED and 1 PENDING — but let's check Hospital B analytics
    // PENDING records are not included in clinical performance
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(doctorBCookies))
      .expect(200);

    const cp = res.body.clinicalPerformance;
    // Hospital B has 1 APPROVED PNEUMONIA (TP=1) and 1 PENDING NORMAL
    // Only 1 reviewed record: TP=1, FP=0, TN=0, FN=0
    // Specificity = TN/(TN+FP) = 0/0 → null
    expect(cp.specificityEstimate).toBeNull();
  });

  // ── Model Performance ────────────────────────────────────────────

  it('should return model performance stats', async () => {
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(doctorACookies))
      .expect(200);

    const models = res.body.modelPerformance;
    expect(models.length).toBeGreaterThan(0);

    const densenet = models.find((m: any) => m.modelName === 'DenseNet121');
    expect(densenet).toBeDefined();
    expect(densenet.totalRuns).toBeGreaterThan(0);
    expect(densenet.averageProbability).toBeGreaterThan(0);

    const ensemble = models.find((m: any) => m.modelName === 'Ensemble');
    expect(ensemble).toBeDefined();
    expect(ensemble.totalRuns).toBe(4);
  });

  it('should extract individual model runs from ensemble modelResultsJson', async () => {
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(doctorACookies))
      .expect(200);

    const models = res.body.modelPerformance;
    // 4 ensemble records each have 3 individual model results
    const effnet = models.find((m: any) => m.modelName === 'EfficientNet-B0');
    expect(effnet).toBeDefined();
    expect(effnet.totalRuns).toBe(4);

    const resnet = models.find((m: any) => m.modelName === 'ResNet50');
    expect(resnet).toBeDefined();
    expect(resnet.totalRuns).toBe(4);
  });

  // ── Tenant Scoping ───────────────────────────────────────────────

  it('should scope analytics to Hospital A for Doctor A', async () => {
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(doctorACookies))
      .expect(200);

    expect(res.body.overview.totalAnalyses).toBe(10);
  });

  it('should scope analytics to Hospital B for Doctor B', async () => {
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(doctorBCookies))
      .expect(200);

    expect(res.body.overview.totalAnalyses).toBe(2);
  });

  it('Hospital A analytics must NOT include Hospital B records', async () => {
    const resA = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(doctorACookies))
      .expect(200);

    const resB = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(doctorBCookies))
      .expect(200);

    expect(resA.body.overview.totalAnalyses + resB.body.overview.totalAnalyses).toBe(12);
    expect(resA.body.overview.totalAnalyses).toBe(10);
    expect(resB.body.overview.totalAnalyses).toBe(2);
  });

  // ── Role Access ──────────────────────────────────────────────────

  it('should reject PATIENT role from analytics', async () => {
    await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(patientCookies))
      .expect(403);
  });

  it('should reject unauthenticated request', async () => {
    await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .expect(401);
  });

  // ── Privacy ──────────────────────────────────────────────────────

  it('should not expose patient data or image URLs in analytics', async () => {
    const res = await request(getApp().getHttpServer())
      .get('/api/v1/ai-analyses/analytics')
      .set('Cookie', buildCookieHeader(doctorACookies))
      .expect(200);

    const body = JSON.stringify(res.body);
    expect(body).not.toContain('patientProfileId');
    expect(body).not.toContain('originalImageUrl');
    expect(body).not.toContain('heatmapImageUrl');
    expect(body).not.toContain('doctorComment');
    expect(body).not.toContain('nationalPatient');
  });
});
