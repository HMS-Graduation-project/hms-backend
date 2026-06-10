import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { AiService } from './ai.service';
import { PredictDiseaseDto } from './dto/predict-disease.dto';
import { DrugInteractionDto } from './dto/drug-interaction.dto';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // ──────────────────── Symptom / Drug (existing) ────────────────────

  @Get('symptoms')
  @Roles(Role.DOCTOR, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'List the symptom catalog (id + label) for the symptom checker',
  })
  async listSymptoms() {
    return this.aiService.getSymptoms();
  }

  @Post('predict-disease')
  @Roles(Role.DOCTOR, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Predict possible diseases from symptoms (AI)',
  })
  async predictDisease(@Body() dto: PredictDiseaseDto) {
    return this.aiService.predictDisease(dto.symptoms);
  }

  @Post('drug-interactions')
  @Roles(Role.DOCTOR, Role.PHARMACIST, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Check drug interactions between medications (AI)',
  })
  async checkDrugInteractions(@Body() dto: DrugInteractionDto) {
    return this.aiService.checkDrugInteractions(dto.medications);
  }

  // ──────────────────── Pneumonia Detection ──────────────────────────

  @Get('pneumonia/health')
  @Roles(Role.DOCTOR, Role.ADMIN, Role.HOSPITAL_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Pneumonia AI model health check',
    description:
      'Returns model loading status, version, threshold, and device.',
  })
  async pneumoniaHealth() {
    return this.aiService.pneumoniaHealth();
  }

  @Post('pneumonia/predict')
  @Roles(Role.DOCTOR, Role.ADMIN, Role.HOSPITAL_ADMIN, Role.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Predict pneumonia from chest X-ray (AI)',
    description:
      'Upload a chest X-ray image (JPG/PNG, max 10 MB). Returns NORMAL or PNEUMONIA prediction. AI-assisted screening only.',
  })
  async pneumoniaPredict(
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.aiService.pneumoniaPredict(file);
  }

  @Post('pneumonia/explain')
  @Roles(Role.DOCTOR, Role.ADMIN, Role.HOSPITAL_ADMIN, Role.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Predict pneumonia with Grad-CAM explanation (AI)',
    description:
      'Upload a chest X-ray image. Returns prediction plus Grad-CAM heatmap and overlay as base64 images.',
  })
  async pneumoniaExplain(
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.aiService.pneumoniaExplain(file);
  }

  @Post('pneumonia/ensemble')
  @Roles(Role.DOCTOR, Role.ADMIN, Role.HOSPITAL_ADMIN, Role.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Ensemble prediction: DenseNet121 + EfficientNet-B0 + ResNet50',
    description:
      'Upload a chest X-ray. Runs 3 models with weighted average consensus and optional Grad-CAM from DenseNet121.',
  })
  async pneumoniaEnsemble(
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.aiService.pneumoniaEnsemble(file, true);
  }
}
