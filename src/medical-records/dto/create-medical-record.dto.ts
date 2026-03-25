import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateMedicalRecordDto {
  @ApiProperty({
    description: 'ID of the completed or in-progress appointment',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  appointmentId: string;

  @ApiPropertyOptional({
    description: 'Chief complaint reported by the patient',
    example: 'Persistent headache for 3 days',
  })
  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @ApiPropertyOptional({
    description: 'History of present illness',
    example: 'Patient reports throbbing headache, worse in the morning',
  })
  @IsOptional()
  @IsString()
  presentIllness?: string;

  @ApiPropertyOptional({
    description: 'Physical examination findings',
    example: 'BP 130/85, no focal neurological deficits',
  })
  @IsOptional()
  @IsString()
  examination?: string;

  @ApiPropertyOptional({
    description: 'Clinical diagnosis',
    example: 'Tension-type headache',
  })
  @IsOptional()
  @IsString()
  diagnosis?: string;

  @ApiPropertyOptional({
    description: 'ICD-10 diagnostic codes (comma-separated)',
    example: 'G44.2',
  })
  @IsOptional()
  @IsString()
  icdCodes?: string;

  @ApiPropertyOptional({
    description: 'Treatment plan',
    example: 'Analgesics, stress management, follow-up in 2 weeks',
  })
  @IsOptional()
  @IsString()
  treatmentPlan?: string;

  @ApiPropertyOptional({
    description: 'Additional clinical notes',
    example: 'Patient advised to monitor symptoms',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
