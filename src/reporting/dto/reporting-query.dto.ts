import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export type ReportingPeriod = '7d' | '30d' | '90d' | '365d';

const PERIODS: ReportingPeriod[] = ['7d', '30d', '90d', '365d'];

export class ReportingQueryDto {
  /**
   * Rolling window used for "daily patient volume", disease trends, etc.
   * Defaults to 30d.
   */
  @ApiPropertyOptional({ enum: PERIODS, default: '30d' })
  @IsOptional()
  @IsIn(PERIODS)
  period?: ReportingPeriod;

  /** Optional city filter for MINISTRY_ADMIN / SUPER_ADMIN drill-down. */
  @ApiPropertyOptional({ description: 'Filter to a single city (UUID)' })
  @IsOptional()
  @IsUUID()
  cityId?: string;

  /** How many top diagnoses / hospitals / trends to return. Default 10. */
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 10 })
  @IsOptional()
  @Transform(({ value }) => (value == null ? value : Number(value)))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
