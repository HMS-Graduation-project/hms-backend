import { Module } from '@nestjs/common';
import { InpatientService } from './inpatient.service';
import { InpatientController } from './inpatient.controller';

@Module({
  providers: [InpatientService],
  controllers: [InpatientController],
  exports: [InpatientService],
})
export class InpatientModule {}
