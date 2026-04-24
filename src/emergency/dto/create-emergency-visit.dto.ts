import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

/**
 * Fast ER intake. Identification is optional: an unconscious patient can be
 * registered with just a `displayName` (e.g. "Unknown Male ~30y") and
 * `chiefComplaint`. Identification can be attached later via
 * PATCH /emergency/visits/:id/link-patient.
 */
export class CreateEmergencyVisitDto {
  @ApiProperty({
    description: 'Placeholder name shown in the queue until identification',
    example: 'Unknown Male ~30y',
  })
  @IsString()
  @Length(1, 200)
  displayName: string;

  @ApiProperty({ example: 'Chest pain, short of breath' })
  @IsString()
  @Length(1, 500)
  chiefComplaint: string;

  @ApiPropertyOptional({ description: 'NHID if patient is already in the national registry' })
  @IsOptional()
  @IsUUID()
  nationalPatientId?: string;

  @ApiPropertyOptional({
    description:
      "PatientProfile id if the patient already has a local profile at this hospital. Rare at intake — usually created later.",
  })
  @IsOptional()
  @IsUUID()
  patientProfileId?: string;
}
