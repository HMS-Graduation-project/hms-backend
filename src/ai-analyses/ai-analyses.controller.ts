import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { AiAnalysesService } from './ai-analyses.service';
import { ReportPdfService } from './pdf/report-pdf.service';
import { CreatePneumoniaAnalysisDto } from './dto/create-pneumonia-analysis.dto';
import { ReviewAiAnalysisDto } from './dto/review-ai-analysis.dto';
import { QueryAiAnalysesDto } from './dto/query-ai-analyses.dto';
import { QueryAiAnalyticsDto } from './dto/query-ai-analytics.dto';

const ALLOWED_MIME = ['image/jpeg', 'image/png'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

@ApiTags('AI Analyses')
@ApiBearerAuth()
@Controller('ai-analyses')
export class AiAnalysesController {
  constructor(
    private readonly service: AiAnalysesService,
    private readonly reportPdf: ReportPdfService,
  ) {}

  @Post('pneumonia')
  @Roles(Role.DOCTOR, Role.ADMIN, Role.HOSPITAL_ADMIN, Role.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Create pneumonia AI analysis',
    description:
      'Upload a chest X-ray, run AI prediction, and save result to patient record.',
  })
  async createPneumonia(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreatePneumoniaAnalysisDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) {
      throw new BadRequestException('X-ray image file is required');
    }
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Only JPG and PNG images are accepted');
    }
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('File size must not exceed 10 MB');
    }
    if (!user.hospitalId) {
      throw new BadRequestException('Hospital context is required');
    }

    return this.service.createPneumoniaAnalysis(dto, file, {
      id: user.id,
      hospitalId: user.hospitalId,
    });
  }

  @Get()
  @Roles(Role.DOCTOR, Role.ADMIN, Role.HOSPITAL_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List AI analyses with filters and pagination' })
  async findAll(@Query() query: QueryAiAnalysesDto) {
    return this.service.findAll(query);
  }

  @Get('analytics')
  @Roles(Role.DOCTOR, Role.ADMIN, Role.HOSPITAL_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get aggregated AI analytics metrics' })
  async getAnalytics(@Query() query: QueryAiAnalyticsDto) {
    return this.service.getAnalytics(query);
  }

  @Get(':id')
  @Roles(Role.DOCTOR, Role.ADMIN, Role.HOSPITAL_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get AI analysis detail' })
  async findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Get(':id/report/pdf')
  @Roles(Role.DOCTOR, Role.ADMIN, Role.HOSPITAL_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Download AI analysis as PDF radiology report' })
  async downloadPdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const record = await this.service.findByIdForReport(id);
    const date = new Date(record.createdAt).toISOString().slice(0, 10);
    const filename = `pneumonia-ai-report-${date}-${record.id.slice(0, 8)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = this.reportPdf.generateReport(record);
    doc.pipe(res);
  }

  @Patch(':id/review')
  @Roles(Role.DOCTOR, Role.ADMIN, Role.HOSPITAL_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Review an AI analysis result',
    description:
      'Transition status to REVIEWED, APPROVED, or REJECTED with optional doctor comment.',
  })
  async review(
    @Param('id') id: string,
    @Body() dto: ReviewAiAnalysisDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.review(id, dto, { id: user.id });
  }
}
