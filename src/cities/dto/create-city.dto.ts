import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CreateCityDto {
  @ApiProperty({ example: 'Damascus' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'دمشق' })
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiPropertyOptional({ example: 'Damascus Governorate' })
  @IsOptional()
  @IsString()
  governorate?: string;

  @ApiPropertyOptional({ description: 'ISO country code', example: 'SY', default: 'SY' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;
}
