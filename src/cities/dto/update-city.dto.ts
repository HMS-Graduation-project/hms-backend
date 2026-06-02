import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class UpdateCityDto {
  @ApiPropertyOptional({ example: 'Damascus' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'دمشق' })
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiPropertyOptional({ example: 'Damascus Governorate' })
  @IsOptional()
  @IsString()
  governorate?: string;

  @ApiPropertyOptional({ example: 'SY' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
