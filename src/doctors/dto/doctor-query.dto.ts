import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class DoctorQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by department ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'Filter by specialization (partial match, case-insensitive)',
    example: 'Cardiology',
  })
  @IsOptional()
  @IsString()
  specialization?: string;
}
