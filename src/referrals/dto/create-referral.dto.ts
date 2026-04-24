import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReferralUrgency } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CreateReferralDto {
  @ApiProperty({ description: 'NHID of the patient being referred' })
  @IsUUID()
  nationalPatientId: string;

  @ApiProperty({ description: 'Receiving hospital id' })
  @IsUUID()
  toHospitalId: string;

  @ApiProperty({ example: 'Suspected STEMI — PCI needed' })
  @IsString()
  @Length(1, 500)
  reason: string;

  @ApiPropertyOptional({
    description:
      'Clinical summary shared with the receiving hospital (history, findings, interventions so far).',
  })
  @IsOptional()
  @IsString()
  @Length(1, 5000)
  clinicalSummary?: string;

  @ApiPropertyOptional({ enum: ReferralUrgency, default: ReferralUrgency.ROUTINE })
  @IsOptional()
  @IsEnum(ReferralUrgency)
  urgency?: ReferralUrgency;
}
