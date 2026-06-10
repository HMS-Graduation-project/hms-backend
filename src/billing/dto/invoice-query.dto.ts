import { ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class InvoiceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by invoice status',
    enum: InvoiceStatus,
    example: InvoiceStatus.ISSUED,
  })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({
    description: 'Filter by patient profile UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  patientId?: string;

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
