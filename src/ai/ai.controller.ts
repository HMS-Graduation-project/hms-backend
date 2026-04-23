import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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
}
