import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * Query params for the medical-records list. Extends pagination/search with
 * national-scope organizational filters (Governorate → Hospital).
 */
export class MedicalRecordQueryDto extends PaginationQueryDto {
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
