import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { AiAnalysesController } from './ai-analyses.controller';
import { AiAnalysesService } from './ai-analyses.service';
import { ReportPdfService } from './pdf/report-pdf.service';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [AiAnalysesController],
  providers: [AiAnalysesService, ReportPdfService],
  exports: [AiAnalysesService],
})
export class AiAnalysesModule {}
