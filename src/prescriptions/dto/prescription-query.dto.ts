import { ApiPropertyOptional } from '@nestjs/swagger';
import { PrescriptionStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class PrescriptionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by prescription status',
    enum: PrescriptionStatus,
    example: PrescriptionStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(PrescriptionStatus)
  status?: PrescriptionStatus;
}
