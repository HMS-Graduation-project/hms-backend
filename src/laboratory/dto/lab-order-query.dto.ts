import { ApiPropertyOptional } from '@nestjs/swagger';
import { LabOrderStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class LabOrderQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by lab order status',
    enum: LabOrderStatus,
    example: LabOrderStatus.ORDERED,
  })
  @IsOptional()
  @IsEnum(LabOrderStatus)
  status?: LabOrderStatus;

  @ApiPropertyOptional({
    description: 'Filter by priority level',
    enum: ['NORMAL', 'URGENT', 'STAT'],
    example: 'NORMAL',
  })
  @IsOptional()
  @IsString()
  priority?: string;

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
