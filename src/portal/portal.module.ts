import { Module } from '@nestjs/common';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

/**
 * Phase 7 — Patient Portal.
 *
 * The portal exposes a `/v1/me/*` surface to PATIENT users. All endpoints
 * fan out across every hospital where the patient has a PatientProfile,
 * keyed by their NHID.
 */
@Module({
  controllers: [PortalController],
  providers: [PortalService],
  exports: [PortalService],
})
export class PortalModule {}
