import { ApiPropertyOptional } from '@nestjs/swagger';
import { EmergencyVisitStatus, TriageLevel } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class EmergencyQueryDto extends PaginationQueryDto {
  /** Filter by status. When omitted, returns all OPEN visits (not DISCHARGED / ADMITTED / TRANSFERRED / LEFT…). */
  @ApiPropertyOptional({ enum: EmergencyVisitStatus })
  @IsOptional()
  @IsEnum(EmergencyVisitStatus)
  status?: EmergencyVisitStatus;

  @ApiPropertyOptional({ enum: TriageLevel })
  @IsOptional()
  @IsEnum(TriageLevel)
  triageLevel?: TriageLevel;

  /** National scope only — filter by the hospital's governorate. */
  @ApiPropertyOptional({ description: "Filter by the hospital's governorate" })
  @IsOptional()
  @IsString()
  governorate?: string;

  /** National scope only — filter by a specific hospital. */
  @ApiPropertyOptional({ description: 'Filter by hospital UUID' })
  @IsOptional()
  @IsUUID()
  hospitalId?: string;
}
