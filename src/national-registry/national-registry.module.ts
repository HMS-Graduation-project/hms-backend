import { Module } from '@nestjs/common';
import { NationalRegistryService } from './national-registry.service';
import { NationalRegistryController } from './national-registry.controller';

@Module({
  providers: [NationalRegistryService],
  controllers: [NationalRegistryController],
  exports: [NationalRegistryService],
})
export class NationalRegistryModule {}
