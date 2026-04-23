import { Module } from '@nestjs/common';
import { LaboratoryService } from './laboratory.service';
import { LaboratoryController } from './laboratory.controller';

@Module({
  providers: [LaboratoryService],
  controllers: [LaboratoryController],
  exports: [LaboratoryService],
})
export class LaboratoryModule {}
