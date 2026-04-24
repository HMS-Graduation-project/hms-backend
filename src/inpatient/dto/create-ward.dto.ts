import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WardType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CreateWardDto {
  @ApiProperty({ example: 'Cardiology Ward A' })
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiProperty({ enum: WardType, default: WardType.GENERAL })
  @IsEnum(WardType)
  type: WardType;

  @ApiPropertyOptional({ description: 'Department this ward belongs to' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ example: '3' })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
