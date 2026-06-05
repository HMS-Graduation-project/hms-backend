import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { CreatePneumoniaAnalysisDto } from './dto/create-pneumonia-analysis.dto';
import { ReviewAiAnalysisDto } from './dto/review-ai-analysis.dto';
import { QueryAiAnalysesDto } from './dto/query-ai-analyses.dto';
import { QueryAiAnalyticsDto } from './dto/query-ai-analytics.dto';
import * as fs from 'fs';
import * as path from 'path';

const UPLOADS_BASE = path.join(process.cwd(), 'uploads', 'ai', 'pneumonia');

const INCLUDE_RELATIONS = {
  patientProfile: {
    select: {
      id: true,
      nationalPatient: {
        select: { id: true, firstName: true, lastName: true, syrianNationalId: true },
      },
    },
  },
  requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
};

function riskLevel(probability: number, threshold: number): string {
  if (probability >= threshold) return 'HIGH';
  if (probability >= 0.70) return 'ELEVATED';
  if (probability >= 0.30) return 'MODERATE';
  return 'LOW';
}

@Injectable()
export class AiAnalysesService {
  private readonly logger = new Logger(AiAnalysesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  /**
   * Create a new pneumonia AI analysis: send image to AI, save result + files.
   */
  async createPneumoniaAnalysis(
    dto: CreatePneumoniaAnalysisDto,
    file: Express.Multer.File,
    currentUser: { id: string; hospitalId: string },
  ) {
    // Validate patient belongs to caller's hospital
    const patient = await this.prisma.patientProfile.findFirst({
      where: { id: dto.patientProfileId, hospitalId: currentUser.hospitalId },
      select: { id: true },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found at your hospital');
    }

    // Call AI service
    const isEnsemble = dto.analysisMode === 'ENSEMBLE';
    let aiResult: any;
    try {
      if (isEnsemble) {
        aiResult = await this.aiService.pneumoniaEnsemble(file, dto.includeGradcam ?? true);
      } else if (dto.includeGradcam) {
        aiResult = await this.aiService.pneumoniaExplain(file);
      } else {
        aiResult = await this.aiService.pneumoniaPredict(file);
      }
    } catch (error) {
      throw new BadRequestException(
        `AI analysis failed: ${error.message || 'Service unavailable'}`,
      );
    }

    // Create DB record first to get the ID for file paths
    const record = await this.prisma.aIAnalysisResult.create({
      data: {
        hospitalId: currentUser.hospitalId,
        patientProfileId: dto.patientProfileId,
        requestedById: currentUser.id,
        analysisType: 'PNEUMONIA_XRAY',
        prediction: aiResult.prediction,
        probability: aiResult.probability,
        confidence: aiResult.confidence,
        threshold: aiResult.threshold,
        riskLevel: isEnsemble
          ? (aiResult.riskLevel || riskLevel(aiResult.probability, aiResult.threshold))
          : riskLevel(aiResult.probability, aiResult.threshold),
        modelVersion: aiResult.modelVersion || 'unknown',
        device: aiResult.device || 'unknown',
        clinicalNote: aiResult.clinicalNote || null,
        // Ensemble fields
        analysisMode: isEnsemble ? 'ENSEMBLE' : 'SINGLE_MODEL',
        ensembleMethod: isEnsemble ? aiResult.ensemble?.method || null : null,
        modelAgreement: isEnsemble ? aiResult.ensemble?.modelAgreement || null : null,
        agreementScore: isEnsemble ? aiResult.ensemble?.agreementScore ?? null : null,
        modelResultsJson: isEnsemble ? aiResult.ensemble?.models || null : null,
        ensembleWeightsJson: isEnsemble ? aiResult.ensemble?.weights || null : null,
      },
    });

    // Save files
    const dir = path.join(UPLOADS_BASE, currentUser.hospitalId, record.id);
    fs.mkdirSync(dir, { recursive: true });

    // Original image
    const origPath = path.join(dir, 'original.jpg');
    fs.writeFileSync(origPath, file.buffer);
    const origUrl = `/uploads/ai/pneumonia/${currentUser.hospitalId}/${record.id}/original.jpg`;

    let heatmapUrl: string | null = null;
    let overlayUrl: string | null = null;

    // Grad-CAM images (decode base64)
    if (aiResult.explainability) {
      try {
        if (aiResult.explainability.heatmapImageBase64) {
          const heatBuf = Buffer.from(aiResult.explainability.heatmapImageBase64, 'base64');
          fs.writeFileSync(path.join(dir, 'heatmap.png'), heatBuf);
          heatmapUrl = `/uploads/ai/pneumonia/${currentUser.hospitalId}/${record.id}/heatmap.png`;
        }
        if (aiResult.explainability.overlayImageBase64) {
          const overlayBuf = Buffer.from(aiResult.explainability.overlayImageBase64, 'base64');
          fs.writeFileSync(path.join(dir, 'overlay.png'), overlayBuf);
          overlayUrl = `/uploads/ai/pneumonia/${currentUser.hospitalId}/${record.id}/overlay.png`;
        }
      } catch (e) {
        this.logger.warn(`Failed to save Grad-CAM images: ${e.message}`);
      }
    }

    // Update record with file URLs
    return this.prisma.aIAnalysisResult.update({
      where: { id: record.id },
      data: { originalImageUrl: origUrl, heatmapImageUrl: heatmapUrl, overlayImageUrl: overlayUrl },
      include: INCLUDE_RELATIONS,
    });
  }

  /**
   * List AI analyses with filters and pagination.
   */
  async findAll(query: QueryAiAnalysesDto) {
    const where: any = {};
    if (query.patientProfileId) where.patientProfileId = query.patientProfileId;
    if (query.status) where.status = query.status;
    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) where.createdAt.gte = new Date(query.fromDate);
      if (query.toDate) where.createdAt.lte = new Date(query.toDate);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.aIAnalysisResult.findMany({
        where,
        include: INCLUDE_RELATIONS,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.aIAnalysisResult.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get single AI analysis detail.
   */
  async findById(id: string) {
    const record = await this.prisma.aIAnalysisResult.findUnique({
      where: { id },
      include: INCLUDE_RELATIONS,
    });
    if (!record) throw new NotFoundException('AI analysis not found');
    return record;
  }

  /**
   * Get single AI analysis with hospital info (for PDF report).
   */
  async findByIdForReport(id: string) {
    const record = await this.prisma.aIAnalysisResult.findUnique({
      where: { id },
      include: {
        ...INCLUDE_RELATIONS,
        hospital: { select: { id: true, name: true, nameAr: true, code: true } },
      },
    });
    if (!record) throw new NotFoundException('AI analysis not found');
    return record;
  }

  /**
   * Doctor reviews an AI analysis result.
   */
  async review(
    id: string,
    dto: ReviewAiAnalysisDto,
    currentUser: { id: string },
  ) {
    const record = await this.prisma.aIAnalysisResult.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!record) throw new NotFoundException('AI analysis not found');

    // Validate status transition
    const allowed: Record<string, string[]> = {
      PENDING_REVIEW: ['REVIEWED', 'APPROVED', 'REJECTED'],
      REVIEWED: ['APPROVED', 'REJECTED'],
    };
    const valid = allowed[record.status] || [];
    if (!valid.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${record.status} to ${dto.status}`,
      );
    }

    return this.prisma.aIAnalysisResult.update({
      where: { id },
      data: {
        status: dto.status as any,
        doctorComment: dto.doctorComment ?? null,
        reviewedById: currentUser.id,
        reviewedAt: new Date(),
      },
      include: INCLUDE_RELATIONS,
    });
  }

  /**
   * Aggregated analytics for AI analyses dashboard.
   */
  async getAnalytics(query: QueryAiAnalyticsDto) {
    const where: any = {};
    if (query.analysisMode) where.analysisMode = query.analysisMode;
    if (query.status) where.status = query.status;
    if (query.riskLevel) where.riskLevel = query.riskLevel;
    if (query.prediction) where.prediction = query.prediction;
    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) where.createdAt.gte = new Date(query.fromDate);
      if (query.toDate) where.createdAt.lte = new Date(query.toDate);
    }

    const records = await this.prisma.aIAnalysisResult.findMany({
      where,
      select: {
        id: true,
        prediction: true,
        probability: true,
        confidence: true,
        riskLevel: true,
        status: true,
        analysisMode: true,
        modelVersion: true,
        modelAgreement: true,
        agreementScore: true,
        modelResultsJson: true,
        createdAt: true,
        reviewedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Overview
    const total = records.length;
    const positiveResults = records.filter((r) => r.prediction === 'PNEUMONIA').length;
    const negativeResults = records.filter((r) => r.prediction === 'NORMAL').length;
    const pendingReview = records.filter((r) => r.status === 'PENDING_REVIEW').length;
    const reviewed = records.filter((r) => r.status === 'REVIEWED').length;
    const approved = records.filter((r) => r.status === 'APPROVED').length;
    const rejected = records.filter((r) => r.status === 'REJECTED').length;
    const ensembleAnalyses = records.filter((r) => r.analysisMode === 'ENSEMBLE').length;
    const singleModelAnalyses = total - ensembleAnalyses;

    // Daily trend
    const dailyMap = new Map<string, number>();
    for (const r of records) {
      const day = r.createdAt.toISOString().slice(0, 10);
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
    }
    const dailyTrend = Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count }));
    const numDays = dailyMap.size || 1;
    const averagePerDay = Math.round((total / numDays) * 100) / 100;

    // Distributions
    const countBy = (key: string) => {
      const map: Record<string, number> = {};
      for (const r of records) {
        const val = (r as any)[key] || 'UNKNOWN';
        map[val] = (map[val] ?? 0) + 1;
      }
      return map;
    };

    // Clinical performance (physician-reviewed estimate)
    const reviewedRecords = records.filter((r) => r.status === 'APPROVED' || r.status === 'REJECTED');
    let tp = 0, fp = 0, tn = 0, fn = 0;
    for (const r of reviewedRecords) {
      if (r.prediction === 'PNEUMONIA' && r.status === 'APPROVED') tp++;
      else if (r.prediction === 'PNEUMONIA' && r.status === 'REJECTED') fp++;
      else if (r.prediction === 'NORMAL' && r.status === 'APPROVED') tn++;
      else if (r.prediction === 'NORMAL' && r.status === 'REJECTED') fn++;
    }
    const totalReviewed = tp + fp + tn + fn;
    const safeDivide = (num: number, den: number) => den > 0 ? Math.round((num / den) * 10000) / 10000 : null;

    // Model performance from individual model results
    const modelStats: Record<string, { runs: number; positive: number; negative: number; probSum: number; confSum: number }> = {};
    const ensembleAgreement = { strong: 0, moderate: 0, low: 0, total: 0, scoreSum: 0 };

    for (const r of records) {
      // Final result model (DenseNet121 for single, Ensemble for ensemble)
      const mName = r.analysisMode === 'ENSEMBLE' ? 'Ensemble' : 'DenseNet121';
      if (!modelStats[mName]) modelStats[mName] = { runs: 0, positive: 0, negative: 0, probSum: 0, confSum: 0 };
      modelStats[mName].runs++;
      if (r.prediction === 'PNEUMONIA') modelStats[mName].positive++;
      else modelStats[mName].negative++;
      modelStats[mName].probSum += r.probability;
      modelStats[mName].confSum += r.confidence;

      // Ensemble agreement
      if (r.analysisMode === 'ENSEMBLE') {
        ensembleAgreement.total++;
        if (r.modelAgreement === 'STRONG') ensembleAgreement.strong++;
        else if (r.modelAgreement === 'MODERATE') ensembleAgreement.moderate++;
        else if (r.modelAgreement === 'LOW') ensembleAgreement.low++;
        if (r.agreementScore != null) ensembleAgreement.scoreSum += r.agreementScore;
      }

      // Individual model results from ensemble JSON
      if (r.modelResultsJson && Array.isArray(r.modelResultsJson)) {
        for (const m of r.modelResultsJson as any[]) {
          const name = m.modelName as string;
          if (!name) continue;
          if (!modelStats[name]) modelStats[name] = { runs: 0, positive: 0, negative: 0, probSum: 0, confSum: 0 };
          modelStats[name].runs++;
          if (m.prediction === 'PNEUMONIA') modelStats[name].positive++;
          else modelStats[name].negative++;
          modelStats[name].probSum += m.probability ?? 0;
          modelStats[name].confSum += m.confidence ?? 0;
        }
      }
    }

    const modelPerformance = Object.entries(modelStats).map(([modelName, s]) => ({
      modelName,
      totalRuns: s.runs,
      positive: s.positive,
      negative: s.negative,
      averageProbability: s.runs > 0 ? Math.round((s.probSum / s.runs) * 10000) / 10000 : 0,
      averageConfidence: s.runs > 0 ? Math.round((s.confSum / s.runs) * 10000) / 10000 : 0,
    }));

    // Add ensemble agreement stats
    if (ensembleAgreement.total > 0) {
      const ens = modelPerformance.find((m) => m.modelName === 'Ensemble');
      if (ens) {
        (ens as any).strongAgreement = Math.round((ensembleAgreement.strong / ensembleAgreement.total) * 100) / 100;
        (ens as any).moderateAgreement = Math.round((ensembleAgreement.moderate / ensembleAgreement.total) * 100) / 100;
        (ens as any).lowAgreement = Math.round((ensembleAgreement.low / ensembleAgreement.total) * 100) / 100;
        (ens as any).averageAgreementScore = Math.round((ensembleAgreement.scoreSum / ensembleAgreement.total) * 100) / 100;
      }
    }

    return {
      overview: {
        totalAnalyses: total,
        positiveResults,
        negativeResults,
        pendingReview,
        reviewed,
        approved,
        rejected,
        ensembleAnalyses,
        singleModelAnalyses,
      },
      usage: {
        dailyTrend,
        averagePerDay,
      },
      distribution: {
        prediction: countBy('prediction'),
        riskLevel: countBy('riskLevel'),
        status: countBy('status'),
        analysisMode: countBy('analysisMode'),
      },
      clinicalPerformance: {
        reviewedRecords: totalReviewed,
        truePositive: tp,
        falsePositive: fp,
        trueNegative: tn,
        falseNegative: fn,
        sensitivityEstimate: safeDivide(tp, tp + fn),
        specificityEstimate: safeDivide(tn, tn + fp),
        precisionEstimate: safeDivide(tp, tp + fp),
        accuracyEstimate: safeDivide(tp + tn, totalReviewed),
      },
      modelPerformance,
    };
  }
}
