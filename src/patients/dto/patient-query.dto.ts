import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class PatientQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by blood type',
    example: 'O+',
  })
  @IsOptional()
  @IsString()
  bloodType?: string;
}
