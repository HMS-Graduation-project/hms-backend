import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdmissionStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class DischargeAdmissionDto {
  @ApiProperty({
    enum: [AdmissionStatus.DISCHARGED, AdmissionStatus.DECEASED],
    default: AdmissionStatus.DISCHARGED,
  })
  @IsEnum(AdmissionStatus)
  status: AdmissionStatus;

  @ApiPropertyOptional({ example: 'Stable on discharge. Follow-up in 2 weeks.' })
  @IsOptional()
  @IsString()
  @Length(1, 4000)
  dischargeSummary?: string;
}
