import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class UserQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter users by role',
    enum: Role,
    example: Role.DOCTOR,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
