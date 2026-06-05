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
    let aiResult: any;
    try {
      if (dto.includeGradcam) {
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
        riskLevel: riskLevel(aiResult.probability, aiResult.threshold),
        modelVersion: aiResult.modelVersion || 'unknown',
        device: aiResult.device || 'unknown',
        clinicalNote: aiResult.clinicalNote || null,
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
}
