import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { AiAnalysesController } from './ai-analyses.controller';
import { AiAnalysesService } from './ai-analyses.service';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [AiAnalysesController],
  providers: [AiAnalysesService],
  exports: [AiAnalysesService],
})
export class AiAnalysesModule {}
