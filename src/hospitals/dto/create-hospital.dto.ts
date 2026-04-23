import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class CreateHospitalDto {
  @ApiProperty({ description: 'Short hospital code (uppercase, unique)', example: 'DAM-GEN-01' })
  @IsString()
  @Matches(/^[A-Z0-9-]+$/, { message: 'code must be uppercase letters, digits, and dashes only' })
  code: string;

  @ApiProperty({ example: 'Damascus General Hospital' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'مستشفى دمشق العام' })
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiProperty({ description: 'City ID (UUID)' })
  @IsUUID()
  cityId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
