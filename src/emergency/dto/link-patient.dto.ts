import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/**
 * Attach identification to an unidentified ER visit.
 * Exactly one of `nationalPatientId` / `patientProfileId` should be set.
 * If only `nationalPatientId` is passed, the service will look up or create
 * a PatientProfile at the current hospital and link both.
 */
export class LinkEmergencyPatientDto {
  @ApiPropertyOptional({ description: 'NHID (master national record)' })
  @IsOptional()
  @IsUUID()
  nationalPatientId?: string;

  @ApiPropertyOptional({ description: 'Local PatientProfile id' })
  @IsOptional()
  @IsUUID()
  patientProfileId?: string;
}
