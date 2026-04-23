import { ApiPropertyOptional } from '@nestjs/swagger';
import { LabOrderStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
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
}
