import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TriageLevel } from '@prisma/client';

export class TriageEmergencyVisitDto {
  @ApiProperty({ enum: TriageLevel, description: 'ESI-equivalent triage level' })
  @IsEnum(TriageLevel)
  triageLevel: TriageLevel;

  @ApiPropertyOptional({ description: 'Free-text triage observation / vital signs summary' })
  @IsOptional()
  @IsString()
  triageNotes?: string;
}
